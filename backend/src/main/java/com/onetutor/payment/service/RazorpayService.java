package com.onetutor.payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onetutor.audit.service.AuditService;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.config.RazorpayProperties;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.dto.EnrollmentResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.payment.dto.*;
import com.onetutor.payment.entity.Payment;
import com.onetutor.payment.entity.PaymentStatus;
import com.onetutor.payment.repository.PaymentRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RazorpayService {

    private static final Logger log = LoggerFactory.getLogger(RazorpayService.class);

    private final RazorpayProperties razorpayProperties;
    private final CourseRepository courseRepository;
    private final PaymentRepository paymentRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentService enrollmentService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final com.onetutor.coupons.service.CouponService couponService;
    private final HttpClient httpClient;

    public RazorpayService(RazorpayProperties razorpayProperties,
                           CourseRepository courseRepository,
                           PaymentRepository paymentRepository,
                           EnrollmentRepository enrollmentRepository,
                           EnrollmentService enrollmentService,
                           AuditService auditService,
                           NotificationService notificationService,
                           UserRepository userRepository,
                           ObjectMapper objectMapper,
                           com.onetutor.coupons.service.CouponService couponService) {
        this.razorpayProperties = razorpayProperties;
        this.courseRepository = courseRepository;
        this.paymentRepository = paymentRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentService = enrollmentService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.couponService = couponService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public RazorpayOrderResponse createOrder(RazorpayOrderRequest req, User student) {
        if (student == null) {
            throw new BadRequestException("AUTH_REQUIRED", "Student authentication required for checkout");
        }

        Course course = courseRepository.findById(req.courseId())
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        if (course.getStatus() != CourseStatus.published) {
            throw new BadRequestException("COURSE_NOT_AVAILABLE", "Course is not published or currently accepting purchases.");
        }

        // Verify student is not already actively enrolled
        enrollmentRepository.findByStudentIdAndCourseIdAndStatus(student.getId(), course.getId(), EnrollmentStatus.active)
                .ifPresent(e -> {
                    throw new ConflictException("ALREADY_ENROLLED", "You are already actively enrolled in this course.");
                });

        Double amount = (req.amount() != null && req.amount() >= 0)
                ? req.amount()
                : (course.getPriceDouble() > 0 ? course.getPriceDouble() : 0.0);

        String currency = (req.currency() != null && !req.currency().isBlank())
                ? req.currency().toUpperCase()
                : (course.getCurrency() != null && !course.getCurrency().isBlank() ? course.getCurrency().toUpperCase() : "INR");

        long amountInPaise = Math.round(amount * 100);

        String orderId;
        boolean isLiveMode = false;

        if (razorpayProperties.isConfigured()) {
            try {
                orderId = callRazorpayApiCreateOrder(amountInPaise, currency, course.getId(), student.getId());
                isLiveMode = !razorpayProperties.getKeyId().startsWith("rzp_test_");
            } catch (Exception e) {
                log.error("Failed to create Razorpay order via API: {}", e.getMessage(), e);
                throw new BadRequestException("RAZORPAY_API_ERROR", "Could not initialize Razorpay order. " + e.getMessage());
            }
        } else {
            // Simulated order ID for testing when placeholder keys are used
            orderId = "order_sim_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
            log.info("Razorpay keys not configured; using simulated order ID: {}", orderId);
        }

        return new RazorpayOrderResponse(
                orderId,
                amount,
                amountInPaise,
                currency,
                razorpayProperties.getKeyId(),
                course.getName(),
                student.getName(),
                student.getEmail(),
                isLiveMode,
                razorpayProperties.isConfigured()
        );
    }

    public Map<String, Object> getConfig() {
        boolean configured = razorpayProperties.isConfigured();
        boolean isLive = configured && !razorpayProperties.getKeyId().startsWith("rzp_test_");
        String mode = !configured ? "SIMULATION" : (isLive ? "LIVE" : "TEST");
        return Map.of(
                "keyId", configured ? razorpayProperties.getKeyId() : "rzp_test_placeholder",
                "currency", razorpayProperties.getCurrency(),
                "enabled", razorpayProperties.isEnabled(),
                "isConfigured", configured,
                "isLiveMode", isLive,
                "mode", mode
        );
    }

    @Transactional
    public PaymentResponse verifyPayment(RazorpayVerifyRequest req, User student) {
        if (student == null) {
            throw new BadRequestException("AUTH_REQUIRED", "Student authentication required for checkout verification");
        }

        Course course = courseRepository.findById(req.courseId())
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        if (course.getStatus() != CourseStatus.published) {
            throw new BadRequestException("COURSE_NOT_AVAILABLE", "Course is not published or currently accepting purchases.");
        }

        // Verify student is not already actively enrolled
        enrollmentRepository.findByStudentIdAndCourseIdAndStatus(student.getId(), course.getId(), EnrollmentStatus.active)
                .ifPresent(e -> {
                    throw new ConflictException("ALREADY_ENROLLED", "You are already actively enrolled in this course.");
                });

        // Verify Razorpay HMAC-SHA256 signature if real keys are configured
        if (razorpayProperties.isConfigured()) {
            if (req.razorpaySignature() == null || req.razorpaySignature().isBlank()) {
                throw new BadRequestException("SIGNATURE_REQUIRED", "Razorpay payment signature is required");
            }

            boolean isValid = verifySignature(req.razorpayOrderId(), req.razorpayPaymentId(), req.razorpaySignature(), razorpayProperties.getKeySecret());
            if (!isValid) {
                log.warn("Razorpay signature verification failed for orderId: {}, paymentId: {}", req.razorpayOrderId(), req.razorpayPaymentId());
                throw new BadRequestException("INVALID_SIGNATURE", "Razorpay signature verification failed. Transaction cannot be validated.");
            }
        }

        Double amount = (req.amount() != null && req.amount() >= 0)
                ? req.amount()
                : (course.getPriceDouble() > 0 ? course.getPriceDouble() : 0.0);

        String currency = (req.currency() != null && !req.currency().isBlank())
                ? req.currency().toUpperCase()
                : (course.getCurrency() != null && !course.getCurrency().isBlank() ? course.getCurrency().toUpperCase() : "INR");

        String pricingType = course.getPricingType() != null ? course.getPricingType() : "subscription";
        String period = course.getSubscriptionPeriod() != null ? course.getSubscriptionPeriod() : "lifetime";

        String couponNote = (req.couponCode() != null && !req.couponCode().isBlank())
                ? " | Coupon: " + req.couponCode().toUpperCase()
                : "";

        // Create Payment record
        Payment payment = new Payment();
        payment.setStudent(student);
        payment.setCourse(course);
        payment.setAmount(amount);
        payment.setCurrency(currency);
        payment.setPaymentMethod("RAZORPAY");
        payment.setTransactionId(req.razorpayPaymentId());
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPricingType(pricingType);
        payment.setSubscriptionPeriod(period);
        payment.setPaymentDetails("Razorpay Order: " + req.razorpayOrderId() + " | Payment ID: " + req.razorpayPaymentId() + couponNote);
        payment.setCreatedAt(Instant.now());

        payment = paymentRepository.save(payment);

        // Perform enrolled course registration
        EnrollmentResponse enrResponse = enrollmentService.enrollPaidCourse(
                course.getId(),
                req.batchId(),
                student,
                payment.getId(),
                pricingType,
                amount
        );

        Enrollment enrollment = enrollmentRepository.findById(enrResponse.id()).orElse(null);
        if (enrollment != null) {
            payment.setEnrollment(enrollment);
            payment = paymentRepository.save(payment);
        }

        // Record coupon redemption if couponCode was supplied
        if (req.couponCode() != null && !req.couponCode().isBlank()) {
            Double origPrice = course.getPriceDouble() > 0 ? course.getPriceDouble() : 0.0;
            Double paidAmount = amount != null ? amount : 0.0;
            java.math.BigDecimal discount = java.math.BigDecimal.valueOf(Math.max(0.0, origPrice - paidAmount));
            couponService.recordRedemption(req.couponCode(), student, payment.getId(), discount);
        }

        // Audit log
        auditService.log(student, "PAYMENT_COMPLETED", "payment", payment.getId(),
                "Student " + student.getName() + " completed Razorpay payment of " + currency + " " + amount + " for course '" + course.getName() + "' (Razorpay Txn: " + req.razorpayPaymentId() + ")");

        // Notify Admins
        try {
            List<User> admins = userRepository.findByRole(UserRole.super_admin);
            if (admins != null && !admins.isEmpty()) {
                String adminTitle = "New Course Purchase via Razorpay: " + course.getName();
                String adminMsg = student.getName() + " (" + student.getEmail() + ") purchased '" + course.getName() + "' for " + currency + " " + amount + " (Razorpay ID: " + req.razorpayPaymentId() + ").";
                notificationService.notifyUsers(admins, adminTitle, adminMsg,
                        com.onetutor.notifications.entity.NotificationType.ENROLLMENT,
                        course.getThumbnail(), "/admin/enrollments");
            }
        } catch (Exception e) {
            log.warn("Failed to notify admins of Razorpay course payment: {}", e.getMessage());
        }

        return PaymentResponse.from(payment);
    }

    private String callRazorpayApiCreateOrder(long amountInPaise, String currency, Long courseId, Long studentId) throws Exception {
        String url = "https://api.razorpay.com/v1/orders";
        String authStr = razorpayProperties.getKeyId() + ":" + razorpayProperties.getKeySecret();
        String authHeader = "Basic " + Base64.getEncoder().encodeToString(authStr.getBytes(StandardCharsets.UTF_8));

        String receipt = ("rcpt_" + courseId + "_" + studentId + "_" + System.currentTimeMillis()).substring(0, Math.min(40, ("rcpt_" + courseId + "_" + studentId + "_" + System.currentTimeMillis()).length()));

        Map<String, Object> bodyMap = Map.of(
                "amount", amountInPaise,
                "currency", currency,
                "receipt", receipt,
                "payment_capture", 1
        );

        String jsonBody = objectMapper.writeValueAsString(bodyMap);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            JsonNode root = objectMapper.readTree(response.body());
            return root.path("id").asText();
        } else {
            log.error("Razorpay order creation failed: Status {}, Body {}", response.statusCode(), response.body());
            throw new RuntimeException("Razorpay API returned status " + response.statusCode() + ": " + response.body());
        }
    }

    private boolean verifySignature(String orderId, String paymentId, String signature, String secret) {
        try {
            String payload = orderId + "|" + paymentId;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expected = HexFormat.of().formatHex(hash);
            return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Signature verification error: {}", e.getMessage());
            return false;
        }
    }
}

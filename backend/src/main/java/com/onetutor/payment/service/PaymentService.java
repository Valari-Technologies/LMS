package com.onetutor.payment.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.dto.EnrollmentResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.payment.dto.CheckoutRequest;
import com.onetutor.payment.dto.PaymentResponse;
import com.onetutor.payment.dto.PaymentStatsResponse;
import com.onetutor.payment.entity.Payment;
import com.onetutor.payment.entity.PaymentStatus;
import com.onetutor.payment.repository.PaymentRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentService enrollmentService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final com.onetutor.coupons.service.CouponService couponService;

    public PaymentService(PaymentRepository paymentRepository,
                          CourseRepository courseRepository,
                          EnrollmentRepository enrollmentRepository,
                          EnrollmentService enrollmentService,
                          AuditService auditService,
                          NotificationService notificationService,
                          UserRepository userRepository,
                          com.onetutor.coupons.service.CouponService couponService) {
        this.paymentRepository = paymentRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentService = enrollmentService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.couponService = couponService;
    }

    @Transactional
    public PaymentResponse processCheckout(CheckoutRequest req, User student) {
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

        // Determine fee and currency (honoring coupon/discounted amount if passed)
        Double amount = (req.amount() != null && req.amount() >= 0) ? req.amount() : (course.getPriceDouble() > 0 ? course.getPriceDouble() : 0.0);
        String currency = course.getCurrency() != null && !course.getCurrency().isBlank() ? course.getCurrency() : (req.currency() != null ? req.currency() : "INR");
        String pricingType = course.getPricingType() != null ? course.getPricingType() : "subscription";
        String period = course.getSubscriptionPeriod() != null ? course.getSubscriptionPeriod() : "lifetime";

        String txnId = req.transactionId();
        if (txnId == null || txnId.isBlank()) {
            txnId = "OT-TXN-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }

        // Create Payment record
        Payment payment = new Payment();
        payment.setStudent(student);
        payment.setCourse(course);
        payment.setAmount(amount);
        payment.setCurrency(currency);
        payment.setPaymentMethod(req.paymentMethod() != null && !req.paymentMethod().isBlank() ? req.paymentMethod().toUpperCase() : "CARD");
        payment.setTransactionId(txnId);
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPricingType(pricingType);
        payment.setSubscriptionPeriod(period);
        payment.setPaymentDetails(req.paymentDetails());
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

        // Record coupon redemption if coupon was applied
        if (req.couponCode() != null && !req.couponCode().isBlank()) {
            Double origPrice = course.getPriceDouble() > 0 ? course.getPriceDouble() : 0.0;
            Double paidAmount = amount != null ? amount : 0.0;
            java.math.BigDecimal discount = req.couponDiscount() != null
                    ? java.math.BigDecimal.valueOf(req.couponDiscount())
                    : java.math.BigDecimal.valueOf(Math.max(0.0, origPrice - paidAmount));
            couponService.recordRedemption(req.couponCode(), student, payment.getId(), discount);
        }

        // Audit log
        auditService.log(student, "PAYMENT_COMPLETED", "payment", payment.getId(),
                "Student " + student.getName() + " completed payment of " + currency + " " + amount + " for course '" + course.getName() + "' (Txn: " + txnId + ")");

        // Notify Admins
        try {
            List<User> admins = userRepository.findByRole(UserRole.super_admin);
            if (admins != null && !admins.isEmpty()) {
                String adminTitle = "New Course Purchase: " + course.getName();
                String adminMsg = student.getName() + " (" + student.getEmail() + ") purchased '" + course.getName() + "' for " + currency + " " + amount + " (Txn: " + txnId + ").";
                notificationService.notifyUsers(admins, adminTitle, adminMsg,
                        com.onetutor.notifications.entity.NotificationType.ENROLLMENT,
                        course.getThumbnail(), "/admin/enrollments");
            }
        } catch (Exception e) {
            log.warn("Failed to notify admins of course payment: {}", e.getMessage());
        }

        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> getMyPayments(User student, Pageable pageable) {
        Page<Payment> page = paymentRepository.findByStudentIdOrderByCreatedAtDesc(student.getId(), pageable);
        return PageResponse.from(page.map(PaymentResponse::from));
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> getAdminPayments(String search, Pageable pageable) {
        String cleanSearch = (search == null || search.isBlank()) ? null : search.trim();
        Page<Payment> page;
        if (cleanSearch == null) {
            page = paymentRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            page = paymentRepository.searchPayments(cleanSearch, pageable);
        }
        return PageResponse.from(page.map(PaymentResponse::from));
    }

    @Transactional(readOnly = true)
    public PaymentStatsResponse getPaymentStats() {
        Double totalRev = paymentRepository.calculateTotalRevenue();
        long successCount = paymentRepository.countByStatus(PaymentStatus.SUCCESS);
        long failedCount = paymentRepository.countByStatus(PaymentStatus.FAILED);
        return new PaymentStatsResponse(totalRev != null ? totalRev : 0.0, successCount, failedCount);
    }
}

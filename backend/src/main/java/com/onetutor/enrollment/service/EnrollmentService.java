package com.onetutor.enrollment.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;
import com.onetutor.batches.repository.BatchRepository;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.common.email.EmailService;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.dto.EnrollmentResponse;
import com.onetutor.enrollment.dto.MyCourseResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class EnrollmentService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final BatchRepository batchRepository;
    private final AuditService auditService;
    private final com.onetutor.notifications.service.NotificationService notificationService;
    private final com.onetutor.progress.service.ProgressService progressService;
    private final EmailService emailService;
    private final String appBaseUrl;

    @org.springframework.beans.factory.annotation.Autowired
    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                              CourseRepository courseRepository,
                              BatchRepository batchRepository,
                              AuditService auditService,
                              com.onetutor.notifications.service.NotificationService notificationService,
                              @org.springframework.context.annotation.Lazy com.onetutor.progress.service.ProgressService progressService,
                              EmailService emailService,
                              @Value("${app.base-url:http://localhost:5173}") String appBaseUrl) {
        this.enrollmentRepository = enrollmentRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.progressService = progressService;
        this.emailService = emailService;
        this.appBaseUrl = appBaseUrl != null ? appBaseUrl : "http://localhost:5173";
    }

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                              CourseRepository courseRepository,
                              BatchRepository batchRepository,
                              AuditService auditService,
                              com.onetutor.notifications.service.NotificationService notificationService,
                              @org.springframework.context.annotation.Lazy com.onetutor.progress.service.ProgressService progressService) {
        this(enrollmentRepository, courseRepository, batchRepository, auditService, notificationService, progressService, null, "http://localhost:5173");
    }

    /** Overloaded legacy enroll without batchId. */
    @Transactional
    public EnrollmentResponse enroll(Long courseId, User student) {
        return enroll(courseId, null, student);
    }

    /**
     * Capacity-based batch enrollment with row-level pessimistic locking.
     * Guarantees that active enrollments in a batch can never exceed batch capacity.
     */
    @Transactional
    public EnrollmentResponse enroll(Long courseId, Long batchId, User student) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        if (course.getStatus() != CourseStatus.published) {
            throw new BadRequestException("COURSE_NOT_ENROLLABLE", "This course is not currently accepting new enrollments.");
        }

        // Paid/subscription course cannot be enrolled for free
        if (course.getPricingType() != null && !course.getPricingType().equalsIgnoreCase("free") 
                && course.getPriceDouble() > 0) {
            String curr = course.getCurrency() != null ? course.getCurrency() : "INR";
            throw new BadRequestException("PAYMENT_REQUIRED", "This course requires a paid subscription or purchase of " 
                    + curr + " " + course.getPriceDouble() + ". Please complete checkout to enroll.");
        }

        return enrollInternal(course, batchId, student, null, "free", 0.0);
    }

    @Transactional
    public EnrollmentResponse enrollPaidCourse(Long courseId, Long batchId, User student, Long paymentId, String pricingType, Double amountPaid) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        if (course.getStatus() != CourseStatus.published) {
            throw new BadRequestException("COURSE_NOT_ENROLLABLE", "This course is not currently accepting new enrollments.");
        }

        return enrollInternal(course, batchId, student, paymentId, pricingType != null ? pricingType : "subscription", amountPaid != null ? amountPaid : 0.0);
    }

    private EnrollmentResponse enrollInternal(Course course, Long batchId, User student, Long paymentId, String pricingType, Double amountPaid) {
        Long courseId = course.getId();

        // 1. Verify student is not already actively enrolled in this course
        enrollmentRepository.findByStudentIdAndCourseIdAndStatus(student.getId(), courseId, EnrollmentStatus.active)
                .ifPresent(e -> {
                    throw new ConflictException("ALREADY_ENROLLED", "You are already enrolled in this course");
                });

        // 2. Determine batch association
        List<Batch> existingBatches = batchRepository.findByCourseId(courseId);
        Batch batch = null;

        if (!existingBatches.isEmpty()) {
            Long resolvedBatchId = batchId;
            if (resolvedBatchId == null) {
                // Auto-assign the first open batch with available seats
                for (Batch candidate : existingBatches) {
                    if (candidate.getStatus() != BatchStatus.cancelled && candidate.getStatus() != BatchStatus.completed) {
                        long enrolledCount = enrollmentRepository.countByBatchIdAndStatus(candidate.getId(), EnrollmentStatus.active);
                        if (enrolledCount < candidate.getCapacity()) {
                            resolvedBatchId = candidate.getId();
                            break;
                        }
                    }
                }
                if (resolvedBatchId == null) {
                    resolvedBatchId = existingBatches.get(0).getId();
                }
            }

            final Long finalBatchId = resolvedBatchId;
            // Pessimistic write lock: SELECT ... FOR UPDATE blocks concurrent transactions for this batch row
            batch = batchRepository.findByIdForUpdate(finalBatchId)
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + finalBatchId));

            if (!batch.getCourse().getId().equals(courseId)) {
                throw new BadRequestException("INVALID_BATCH_COURSE", "The selected batch does not belong to this course.");
            }

            if (batch.getStatus() == BatchStatus.cancelled || batch.getStatus() == BatchStatus.completed) {
                throw new BadRequestException("BATCH_UNAVAILABLE", "The selected batch is no longer accepting enrollments (" + batch.getStatus() + ").");
            }

            long currentEnrolledInBatch = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);
            if (currentEnrolledInBatch >= batch.getCapacity()) {
                throw new ConflictException("BATCH_FULL", "Batch '" + batch.getName() + "' is full (" + batch.getCapacity() + "/" + batch.getCapacity() + " seats filled).");
            }
        } else if (batchId != null) {
            batch = batchRepository.findByIdForUpdate(batchId)
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));
        }

        Enrollment enrollment = new Enrollment();
        enrollment.setStudent(student);
        enrollment.setCourse(course);
        enrollment.setBatch(batch);
        enrollment.setStatus(EnrollmentStatus.active);
        enrollment.setPaymentId(paymentId);
        enrollment.setPricingType(pricingType);
        enrollment.setAmountPaid(amountPaid);

        try {
            enrollmentRepository.save(enrollment);
        } catch (DataIntegrityViolationException e) {
            // Concurrent duplicate request lost the race against the unique index.
            throw new ConflictException("ALREADY_ENROLLED", "You are already enrolled in this course");
        }

        String batchSuffix = batch != null ? " in " + batch.getName() : "";
        String feeSuffix = amountPaid > 0 ? " (Paid " + (course.getCurrency() != null ? course.getCurrency() : "INR") + " " + amountPaid + ")" : " (Free)";
        auditService.log(student, "STUDENT_ENROLLED", "enrollment", enrollment.getId(),
                "Student enrolled in course '" + course.getName() + "'" + batchSuffix + feeSuffix + " (id " + courseId + ")");

        notificationService.notify(student, "Enrolled in " + course.getName(),
                "You have successfully enrolled in " + course.getName() + batchSuffix + "! You can now access all course materials.",
                com.onetutor.notifications.entity.NotificationType.ENROLLMENT);

        // Dispatch enrollment greeting email with course details, batch, and direct learning link
        if (emailService != null && student.getEmail() != null && !student.getEmail().isBlank()) {
            try {
                String courseThumbnail = course.getThumbnail();
                if (courseThumbnail != null && !courseThumbnail.isBlank()
                        && !courseThumbnail.startsWith("http://") && !courseThumbnail.startsWith("https://")) {
                    courseThumbnail = appBaseUrl + (courseThumbnail.startsWith("/") ? "" : "/") + courseThumbnail;
                }
                String categoryName = course.getCategory() != null ? course.getCategory().getName() : null;
                String batchName = batch != null ? batch.getName() : null;
                String learnUrl = appBaseUrl + "/student/learn/" + course.getId();

                emailService.sendEnrollmentGreetingEmail(
                        student.getEmail(),
                        student.getName(),
                        course.getName(),
                        courseThumbnail,
                        categoryName,
                        batchName,
                        learnUrl
                );
            } catch (Exception e) {
                log.warn("Failed to dispatch enrollment greeting email to {}: {}", student.getEmail(), e.getMessage());
            }
        }

        return toResponse(enrollment);
    }

    public PageResponse<MyCourseResponse> myCourses(User student, Pageable pageable) {
        Page<Enrollment> page = enrollmentRepository.findByStudentIdAndStatus(
                student.getId(), EnrollmentStatus.active, pageable);
        return PageResponse.from(page.map(e -> {
            Double pct = null;
            try {
                pct = progressService.getCourseProgressForStudent(e.getCourse().getId(), student.getId()).progressPercent();
            } catch (Exception ignored) {}
            return new MyCourseResponse(
                    e.getId(), e.getCourse().getId(), e.getCourse().getName(),
                    e.getCourse().getThumbnail(), e.getCourse().getStatus().name(),
                    pct, null,
                    e.getBatch() != null ? e.getBatch().getId() : null,
                    e.getBatch() != null ? e.getBatch().getName() : null,
                    e.getCourse().getLevel()
            );
        }));
    }

    /**
     * SRS section 16: verifies the caller has an active enrollment in the
     * given course before granting access to protected learning content.
     */
    public void assertActiveEnrollment(User user, Long courseId) {
        if (user == null) {
            throw new ForbiddenException("AUTHENTICATION_REQUIRED", "Please log in to view course content");
        }
        // Admins and content creators always have access
        if (user.getRole() == com.onetutor.users.entity.UserRole.admin ||
            user.getRole() == com.onetutor.users.entity.UserRole.super_admin ||
            user.getRole() == com.onetutor.users.entity.UserRole.content_creator) {
            return;
        }

        // Check if the student has a removed enrollment — explicitly block access
        enrollmentRepository.findByStudentIdAndCourseId(user.getId(), courseId).ifPresent(e -> {
            if (e.getStatus() == EnrollmentStatus.removed) {
                throw new ForbiddenException("ENROLLMENT_REMOVED",
                        "Your access to this course has been removed by an administrator.");
            }
        });

        // Enforce active enrollment — no auto-enroll fallback
        assertActiveEnrollment(user.getId(), courseId);
    }

    public boolean isActivelyEnrolled(Long studentId, Long courseId) {
        return enrollmentRepository.findByStudentIdAndCourseIdAndStatus(studentId, courseId, EnrollmentStatus.active).isPresent();
    }

    public void assertActiveEnrollment(Long studentId, Long courseId) {
        enrollmentRepository.findByStudentIdAndCourseIdAndStatus(studentId, courseId, EnrollmentStatus.active)
                .orElseThrow(() -> new ForbiddenException("NOT_ENROLLED", "You are not enrolled in this course"));
    }

    /** Admin view: all enrollments for a course (SRS section 28). */
    public PageResponse<EnrollmentResponse> byCourse(Long courseId, Pageable pageable) {
        return PageResponse.from(enrollmentRepository.findByCourseId(courseId, pageable).map(this::toResponse));
    }

    /** Admin view: all enrollments for a student (SRS section 28). */
    public PageResponse<EnrollmentResponse> byStudent(Long studentId, Pageable pageable) {
        return PageResponse.from(enrollmentRepository.findByStudentId(studentId, pageable).map(this::toResponse));
    }

    private EnrollmentResponse toResponse(Enrollment e) {
        return new EnrollmentResponse(
                e.getId(),
                e.getCourse().getId(),
                e.getCourse().getName(),
                e.getCourse().getThumbnail(),
                e.getStatus().name(),
                e.getEnrolledAt(),
                e.getBatch() != null ? e.getBatch().getId() : null,
                e.getBatch() != null ? e.getBatch().getName() : null,
                e.getBatch() != null ? e.getBatch().getCode() : null,
                e.getPricingType() != null ? e.getPricingType() : "free",
                e.getAmountPaidDouble()
        );
    }
}

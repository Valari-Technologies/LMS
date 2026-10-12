package com.onetutor.admin.controller;

import com.onetutor.admin.dto.AdminEnrollmentResponse;
import com.onetutor.admin.dto.CourseEnrollmentStatResponse;
import com.onetutor.audit.service.AuditService;
import com.onetutor.batches.repository.BatchRepository;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/enrollments")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
@Transactional(readOnly = true)
public class AdminEnrollmentController {

    private final EnrollmentRepository enrollmentRepository;
    private final BatchRepository batchRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public AdminEnrollmentController(EnrollmentRepository enrollmentRepository,
                                     BatchRepository batchRepository,
                                     AuditService auditService,
                                     NotificationService notificationService) {
        this.enrollmentRepository = enrollmentRepository;
        this.batchRepository = batchRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminEnrollmentResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        EnrollmentStatus enrollmentStatus = null;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            try {
                enrollmentStatus = EnrollmentStatus.valueOf(status.toLowerCase());
            } catch (IllegalArgumentException ignored) {}
        }

        String q = (search == null || search.isBlank()) ? null : search.trim();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "enrolledAt"));

        Page<Enrollment> result;

        if (q != null && enrollmentStatus != null && categoryId != null) {
            result = enrollmentRepository.searchByStatusAndCategoryAndText(enrollmentStatus, categoryId, q, pageable);
        } else if (q != null && enrollmentStatus != null) {
            result = enrollmentRepository.searchByStatusAndText(enrollmentStatus, q, pageable);
        } else if (q != null && categoryId != null) {
            result = enrollmentRepository.searchByCategoryAndText(categoryId, q, pageable);
        } else if (enrollmentStatus != null && categoryId != null) {
            result = enrollmentRepository.findByStatusAndCategoryId(enrollmentStatus, categoryId, pageable);
        } else if (q != null) {
            result = enrollmentRepository.searchByText(q, pageable);
        } else if (enrollmentStatus != null) {
            result = enrollmentRepository.findByStatus(enrollmentStatus, pageable);
        } else if (categoryId != null) {
            result = enrollmentRepository.findByCategoryId(categoryId, pageable);
        } else {
            result = enrollmentRepository.findAll(pageable);
        }

        return ApiResponse.ok(PageResponse.from(result.map(AdminEnrollmentResponse::from)));
    }

    @GetMapping("/stats")
    public ApiResponse<List<CourseEnrollmentStatResponse>> stats() {
        return ApiResponse.ok(enrollmentRepository.findEnrollmentStatsByCourse());
    }

    @PutMapping("/{id}/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Transactional
    public ApiResponse<AdminEnrollmentResponse> assignBatch(
            @PathVariable Long id,
            @RequestParam(required = false) Long batchId,
            @AuthenticationPrincipal User actor) {
        Enrollment enrollment = enrollmentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ENROLLMENT_NOT_FOUND", "Enrollment not found with ID: " + id));

        com.onetutor.batches.entity.Batch batch = null;
        if (batchId != null) {
            batch = batchRepository.findById(batchId)
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));
            if (!batch.getCourse().getId().equals(enrollment.getCourse().getId())) {
                throw new BadRequestException("COURSE_MISMATCH", "Batch does not belong to the enrolled course");
            }
            long activeCount = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);
            if (activeCount >= batch.getCapacity() && (enrollment.getBatch() == null || !enrollment.getBatch().getId().equals(batch.getId()))) {
                throw new ConflictException("BATCH_FULL", "Batch '" + batch.getName() + "' is at full capacity (" + batch.getCapacity() + ").");
            }
        }

        enrollment.setBatch(batch);
        enrollmentRepository.save(enrollment);

        String batchMsg = batch != null ? "Assigned to batch '" + batch.getName() + "'" : "Removed from batch";
        if (auditService != null) {
            auditService.log(actor, "ASSIGN_ENROLLMENT_BATCH", "Enrollment", enrollment.getId(), batchMsg + " for student " + (enrollment.getStudent() != null ? enrollment.getStudent().getName() : "Student"));
        }

        return ApiResponse.ok("Batch updated successfully", AdminEnrollmentResponse.from(enrollment));
    }

    @PutMapping("/{id}/remove")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Transactional
    public ApiResponse<AdminEnrollmentResponse> removeEnrollment(
            @PathVariable Long id,
            @AuthenticationPrincipal User actor) {
        Enrollment enrollment = enrollmentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ENROLLMENT_NOT_FOUND", "Enrollment not found with ID: " + id));

        // Capture batch reference before saving status change
        com.onetutor.batches.entity.Batch enrolledBatch = enrollment.getBatch();

        enrollment.setStatus(EnrollmentStatus.removed);
        enrollment.setRemovedAt(java.time.Instant.now());
        enrollmentRepository.save(enrollment);

        // Auto-heal batch status: if batch was "full" but now has a free seat, mark it active
        if (enrolledBatch != null
                && enrolledBatch.getStatus() == com.onetutor.batches.entity.BatchStatus.full) {
            long remaining = enrollmentRepository.countByBatchIdAndStatus(
                    enrolledBatch.getId(), EnrollmentStatus.active);
            if (remaining < enrolledBatch.getCapacity()) {
                enrolledBatch.setStatus(com.onetutor.batches.entity.BatchStatus.active);
                batchRepository.save(enrolledBatch);
            }
        }

        if (auditService != null) {
            auditService.log(actor, "REMOVE_STUDENT_ENROLLMENT", "Enrollment", enrollment.getId(),
                    "Removed student '" + (enrollment.getStudent() != null ? enrollment.getStudent().getName() : "") + "' from course '" + (enrollment.getCourse() != null ? enrollment.getCourse().getName() : "") + "'");
        }

        if (notificationService != null && enrollment.getStudent() != null) {
            try {
                notificationService.notify(enrollment.getStudent(),
                        "Course Access Update",
                        "Your enrollment for course " + (enrollment.getCourse() != null ? enrollment.getCourse().getName() : "course") + " has been removed by an administrator.",
                        com.onetutor.notifications.entity.NotificationType.ENROLLMENT);
            } catch (Exception ignored) {}
        }

        return ApiResponse.ok("Student removed from course successfully", AdminEnrollmentResponse.from(enrollment));
    }

    @PutMapping("/{id}/rejoin")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Transactional
    public ApiResponse<AdminEnrollmentResponse> rejoinEnrollment(
            @PathVariable Long id,
            @RequestParam(required = false) Long batchId,
            @AuthenticationPrincipal User actor) {
        Enrollment enrollment = enrollmentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ENROLLMENT_NOT_FOUND", "Enrollment not found with ID: " + id));

        if (batchId != null) {
            com.onetutor.batches.entity.Batch batch = batchRepository.findById(batchId)
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));
            if (!batch.getCourse().getId().equals(enrollment.getCourse().getId())) {
                throw new BadRequestException("COURSE_MISMATCH", "Batch does not belong to the enrolled course");
            }
            enrollment.setBatch(batch);
        }

        enrollment.setStatus(EnrollmentStatus.active);
        enrollment.setRemovedAt(null);
        enrollmentRepository.save(enrollment);

        if (auditService != null) {
            auditService.log(actor, "REJOIN_STUDENT_ENROLLMENT", "Enrollment", enrollment.getId(),
                    "Rejoined student '" + (enrollment.getStudent() != null ? enrollment.getStudent().getName() : "") + "' to course '" + (enrollment.getCourse() != null ? enrollment.getCourse().getName() : "") + "'");
        }

        if (notificationService != null && enrollment.getStudent() != null) {
            try {
                notificationService.notify(enrollment.getStudent(),
                        "Course Re-enrollment",
                        "Your access to course " + (enrollment.getCourse() != null ? enrollment.getCourse().getName() : "course") + " has been restored.",
                        com.onetutor.notifications.entity.NotificationType.ENROLLMENT);
            } catch (Exception ignored) {}
        }

        return ApiResponse.ok("Student re-enrolled successfully", AdminEnrollmentResponse.from(enrollment));
    }
}


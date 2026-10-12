package com.onetutor.batches.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.batches.dto.*;
import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;
import com.onetutor.batches.repository.BatchRepository;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.notifications.entity.NotificationType;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.progress.service.ProgressService;
import com.onetutor.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class BatchService {

    private final BatchRepository batchRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AuditService auditService;
    private final ProgressService progressService;
    private final NotificationService notificationService;

    public BatchService(BatchRepository batchRepository,
                        CourseRepository courseRepository,
                        EnrollmentRepository enrollmentRepository,
                        AuditService auditService,
                        ProgressService progressService,
                        NotificationService notificationService) {
        this.batchRepository = batchRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.auditService = auditService;
        this.progressService = progressService;
        this.notificationService = notificationService;
    }

    public BatchResponse create(CreateBatchRequest req, User actor) {
        Course course = courseRepository.findById(req.courseId())
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found with ID: " + req.courseId()));

        if (req.capacity() == null || req.capacity() <= 0) {
            throw new BadRequestException("INVALID_CAPACITY", "Batch capacity must be greater than 0");
        }

        String code = req.code().trim().toUpperCase();
        if (batchRepository.existsByCourseIdAndCode(course.getId(), code)) {
            throw new ConflictException("DUPLICATE_BATCH_CODE", "A batch with code '" + code + "' already exists for this course");
        }

        if (req.startDate() != null && req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw new BadRequestException("INVALID_DATES", "Batch end date cannot be before start date");
        }

        Batch batch = new Batch();
        batch.setCourse(course);
        batch.setName(req.name().trim());
        batch.setCode(code);
        batch.setCapacity(req.capacity());
        batch.setStatus(req.status() != null ? req.status() : BatchStatus.upcoming);
        batch.setStartDate(req.startDate());
        batch.setEndDate(req.endDate());

        batchRepository.save(batch);

        auditService.log(actor, "CREATE_BATCH", "Batch", batch.getId(),
                "Created batch '" + batch.getName() + "' for course '" + course.getName() + "' with capacity " + batch.getCapacity());

        return BatchResponse.from(batch, 0);
    }

    public BatchResponse update(Long batchId, UpdateBatchRequest req, User actor) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));

        if (req.capacity() == null || req.capacity() <= 0) {
            throw new BadRequestException("INVALID_CAPACITY", "Batch capacity must be greater than 0");
        }

        String code = req.code().trim().toUpperCase();
        if (batchRepository.existsByCourseIdAndCodeAndIdNot(batch.getCourse().getId(), code, batchId)) {
            throw new ConflictException("DUPLICATE_BATCH_CODE", "A batch with code '" + code + "' already exists for this course");
        }

        if (req.startDate() != null && req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw new BadRequestException("INVALID_DATES", "Batch end date cannot be before start date");
        }

        // Capacity reduction safety validation
        long currentActiveEnrolled = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);
        if (req.capacity() < currentActiveEnrolled) {
            throw new BadRequestException("CAPACITY_BELOW_ENROLLED",
                    "Cannot reduce batch capacity below the current number of active enrollments (" + currentActiveEnrolled + ").");
        }

        batch.setName(req.name().trim());
        batch.setCode(code);
        batch.setCapacity(req.capacity());
        if (req.status() != null) {
            batch.setStatus(req.status());
        }
        batch.setStartDate(req.startDate());
        batch.setEndDate(req.endDate());

        batchRepository.save(batch);

        auditService.log(actor, "UPDATE_BATCH", "Batch", batch.getId(),
                "Updated batch '" + batch.getName() + "' (capacity: " + batch.getCapacity() + ")");

        return BatchResponse.from(batch, currentActiveEnrolled);
    }

    public BatchResponse updateStatus(Long batchId, BatchStatus status, User actor) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));

        batch.setStatus(status);
        batchRepository.save(batch);

        long currentActiveEnrolled = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);

        auditService.log(actor, "UPDATE_BATCH_STATUS", "Batch", batch.getId(),
                "Updated batch '" + batch.getName() + "' status to " + status);

        return BatchResponse.from(batch, currentActiveEnrolled);
    }

    @Transactional(readOnly = true)
    public BatchResponse getBatch(Long batchId) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));

        long currentActiveEnrolled = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);
        return BatchResponse.from(batch, currentActiveEnrolled);
    }

    @Transactional(readOnly = true)
    public List<BatchResponse> listBatchesForCourse(Long courseId, boolean activeOnly) {
        List<Batch> batches = batchRepository.findByCourseIdOrderByIdAsc(courseId);

        if (activeOnly) {
            batches = batches.stream()
                    .filter(b -> b.getStatus() == BatchStatus.upcoming || b.getStatus() == BatchStatus.active)
                    .toList();
        }

        return batches.stream()
                .map(b -> {
                    long activeCount = enrollmentRepository.countByBatchIdAndStatus(b.getId(), EnrollmentStatus.active);
                    return BatchResponse.from(b, activeCount);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<BatchResponse> adminList(Long courseId, BatchStatus status, String search, Pageable pageable) {
        Page<Batch> page;
        if (search != null && !search.trim().isBlank()) {
            page = batchRepository.searchBatches(courseId, status, search.trim(), pageable);
        } else {
            page = batchRepository.filterBatches(courseId, status, pageable);
        }
        return PageResponse.from(page.map(b -> {
            long activeCount = enrollmentRepository.countByBatchIdAndStatus(b.getId(), EnrollmentStatus.active);
            return BatchResponse.from(b, activeCount);
        }));
    }

    @Transactional(readOnly = true)
    public PageResponse<BatchStudentResponse> listBatchStudents(Long batchId, Pageable pageable) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));

        Page<Enrollment> page = enrollmentRepository.findBatchStudentsWithUser(batchId, EnrollmentStatus.active, pageable);
        return PageResponse.from(page.map(e -> {
            Double progressPercent = 0.0;
            Integer completedContents = 0;
            Integer totalContents = 0;
            try {
                if (progressService != null && batch.getCourse() != null) {
                    var cp = progressService.getCourseProgressForStudent(batch.getCourse().getId(), e.getStudent().getId());
                    if (cp != null) {
                        progressPercent = cp.progressPercent();
                        completedContents = cp.completedContents();
                        totalContents = cp.totalContents();
                    }
                }
            } catch (Exception ignored) {}
            return BatchStudentResponse.from(e, progressPercent, completedContents, totalContents);
        }));
    }

    public void removeStudentFromBatch(Long batchId, Long enrollmentId, User actor) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + batchId));

        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new NotFoundException("ENROLLMENT_NOT_FOUND", "Enrollment not found with ID: " + enrollmentId));

        if (enrollment.getBatch() == null || !enrollment.getBatch().getId().equals(batchId)) {
            throw new BadRequestException("ENROLLMENT_BATCH_MISMATCH", "Student is not enrolled in this batch");
        }

        enrollment.setStatus(EnrollmentStatus.removed);
        enrollment.setRemovedAt(Instant.now());
        enrollmentRepository.save(enrollment);

        long currentActiveEnrolled = enrollmentRepository.countByBatchIdAndStatus(batch.getId(), EnrollmentStatus.active);
        if (batch.getStatus() == BatchStatus.full && currentActiveEnrolled < batch.getCapacity()) {
            batch.setStatus(BatchStatus.active);
            batchRepository.save(batch);
        }

        auditService.log(actor, "REMOVE_STUDENT_FROM_BATCH", "Batch", batch.getId(),
                "Removed student '" + enrollment.getStudent().getName() + "' (" + enrollment.getStudent().getEmail() + ") from batch '" + batch.getName() + "'");

        try {
            if (notificationService != null) {
                notificationService.notify(enrollment.getStudent(),
                        "Batch & Course Access Update",
                        "You have been removed from batch " + batch.getName() + " for course " + batch.getCourse().getName() + ". Your access to this course has been revoked.",
                        NotificationType.ENROLLMENT);
            }
        } catch (Exception ignored) {}
    }

    public void changeStudentBatch(Long currentBatchId, Long enrollmentId, Long targetBatchId, User actor) {
        if (targetBatchId == null) {
            throw new BadRequestException("INVALID_TARGET_BATCH", "Target batch ID must be provided");
        }
        if (currentBatchId.equals(targetBatchId)) {
            throw new BadRequestException("SAME_BATCH", "Student is already in this batch");
        }

        Batch currentBatch = batchRepository.findById(currentBatchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Current batch not found with ID: " + currentBatchId));

        Batch targetBatch = batchRepository.findById(targetBatchId)
                .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Target batch not found with ID: " + targetBatchId));

        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new NotFoundException("ENROLLMENT_NOT_FOUND", "Enrollment not found with ID: " + enrollmentId));

        if (enrollment.getBatch() == null || !enrollment.getBatch().getId().equals(currentBatchId)) {
            throw new BadRequestException("ENROLLMENT_BATCH_MISMATCH", "Student is not enrolled in this batch");
        }

        if (enrollment.getStatus() != EnrollmentStatus.active) {
            throw new BadRequestException("ENROLLMENT_INACTIVE", "Cannot change batch for an inactive or removed enrollment");
        }

        if (!targetBatch.getCourse().getId().equals(currentBatch.getCourse().getId())) {
            throw new BadRequestException("COURSE_MISMATCH", "Target batch belongs to a different course");
        }

        // Check target batch capacity
        long targetActiveCount = enrollmentRepository.countByBatchIdAndStatus(targetBatch.getId(), EnrollmentStatus.active);
        if (targetActiveCount >= targetBatch.getCapacity()) {
            throw new ConflictException("TARGET_BATCH_FULL",
                    "Target batch '" + targetBatch.getName() + "' is at full capacity (" + targetBatch.getCapacity() + "/" + targetBatch.getCapacity() + " seats occupied).");
        }

        enrollment.setBatch(targetBatch);
        enrollmentRepository.save(enrollment);

        auditService.log(actor, "CHANGE_STUDENT_BATCH", "Batch", targetBatch.getId(),
                "Moved student '" + enrollment.getStudent().getName() + "' (" + enrollment.getStudent().getEmail() + ") from batch '" + currentBatch.getName() + "' to batch '" + targetBatch.getName() + "'");

        try {
            if (notificationService != null) {
                notificationService.notify(enrollment.getStudent(),
                        "Batch Transferred",
                        "Your batch for " + currentBatch.getCourse().getName() + " has been changed from " + currentBatch.getName() + " to " + targetBatch.getName() + ".",
                        NotificationType.ENROLLMENT);
            }
        } catch (Exception ignored) {}
    }
}

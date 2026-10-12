package com.onetutor.admin.controller;

import com.onetutor.admin.dto.AdminStudentProgressResponse;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.progress.service.ProgressService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/progress")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
@Transactional(readOnly = true)
public class AdminProgressController {

    private final EnrollmentRepository enrollmentRepository;
    private final ProgressService progressService;

    public AdminProgressController(EnrollmentRepository enrollmentRepository,
                                   ProgressService progressService) {
        this.enrollmentRepository = enrollmentRepository;
        this.progressService = progressService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminStudentProgressResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        String q = (search == null || search.isBlank()) ? null : search.trim();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "enrolledAt"));

        Page<Enrollment> enrollments;
        if (q != null && categoryId != null) {
            enrollments = enrollmentRepository.searchByStatusAndCategoryAndText(EnrollmentStatus.active, categoryId, q, pageable);
        } else if (q != null) {
            enrollments = enrollmentRepository.searchByStatusAndText(EnrollmentStatus.active, q, pageable);
        } else if (categoryId != null) {
            enrollments = enrollmentRepository.findByStatusAndCategoryId(EnrollmentStatus.active, categoryId, pageable);
        } else {
            enrollments = enrollmentRepository.findByStatus(EnrollmentStatus.active, pageable);
        }

        Page<AdminStudentProgressResponse> mapped = enrollments.map(e -> {
            var cp = progressService.getCourseProgressForStudent(e.getCourse().getId(), e.getStudent().getId());
            return new AdminStudentProgressResponse(
                    e.getStudent().getId(),
                    e.getStudent().getName(),
                    e.getStudent().getEmail(),
                    e.getCourse().getId(),
                    e.getCourse().getName(),
                    cp.progressPercent(),
                    cp.completedContents(),
                    cp.totalContents(),
                    e.getEnrolledAt(),
                    cp.lastAccessedAt()
            );
        });

        return ApiResponse.ok(PageResponse.from(mapped));
    }
}

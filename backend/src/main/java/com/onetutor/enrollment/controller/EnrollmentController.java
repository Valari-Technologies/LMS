package com.onetutor.enrollment.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.enrollment.dto.EnrollmentResponse;
import com.onetutor.enrollment.dto.MyCourseResponse;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.users.entity.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    public EnrollmentController(EnrollmentService enrollmentService) {
        this.enrollmentService = enrollmentService;
    }

    @PostMapping("/courses/{courseId}/enroll")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ApiResponse<EnrollmentResponse> enroll(
            @PathVariable Long courseId,
            @RequestBody(required = false) com.onetutor.enrollment.dto.EnrollRequest req,
            @RequestParam(required = false) Long batchId,
            @AuthenticationPrincipal User student) {
        Long effectiveBatchId = (req != null && req.batchId() != null) ? req.batchId() : batchId;
        return ApiResponse.ok("Enrolled successfully", enrollmentService.enroll(courseId, effectiveBatchId, student));
    }

    @GetMapping("/my-courses")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ApiResponse<PageResponse<MyCourseResponse>> myCourses(
            @AuthenticationPrincipal User student,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(enrollmentService.myCourses(student, PageRequest.of(page, size)));
    }

    @GetMapping("/admin/enrollments/by-course/{courseId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
    public ApiResponse<PageResponse<EnrollmentResponse>> byCourse(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(enrollmentService.byCourse(courseId, PageRequest.of(page, size)));
    }

    @GetMapping("/admin/enrollments/by-student/{studentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
    public ApiResponse<PageResponse<EnrollmentResponse>> byStudent(
            @PathVariable Long studentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(enrollmentService.byStudent(studentId, PageRequest.of(page, size)));
    }
}

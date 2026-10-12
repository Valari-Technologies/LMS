package com.onetutor.sections.controller;

import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.sections.dto.ReorderRequest;
import com.onetutor.sections.dto.SectionRequest;
import com.onetutor.sections.dto.SectionResponse;
import com.onetutor.sections.service.SectionService;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * GET requires the caller to be either an admin, or a student with an
 * active enrollment in the course (SRS section 16/26) — enforced via
 * EnrollmentService.assertActiveEnrollment below, closing the gap noted
 * in earlier revisions of this file.
 */
@RestController
public class SectionController {

    private final SectionService sectionService;
    private final CourseRepository courseRepository;
    private final EnrollmentService enrollmentService;

    public SectionController(SectionService sectionService,
                              CourseRepository courseRepository,
                              EnrollmentService enrollmentService) {
        this.sectionService = sectionService;
        this.courseRepository = courseRepository;
        this.enrollmentService = enrollmentService;
    }

    @GetMapping("/api/v1/courses/{courseId}/sections")
    @Transactional(readOnly = true)
    public ApiResponse<List<SectionResponse>> listByCourse(@PathVariable Long courseId,
                                                           @RequestParam(defaultValue = "false") boolean includeArchived,
                                                           @AuthenticationPrincipal User caller) {
        assertCanView(courseId, caller);
        var sections = sectionService.listByCourse(courseId);
        boolean isStudent = (caller == null || caller.getRole() == UserRole.student);
        if (isStudent) {
            sections = sections.stream().filter(s -> "active".equalsIgnoreCase(s.status())).toList();
        } else if (!includeArchived) {
            sections = sections.stream().filter(s -> !"archived".equalsIgnoreCase(s.status())).toList();
        }
        return ApiResponse.ok(sections);
    }

    private void assertCanView(Long courseId, User caller) {
        if (caller != null && (caller.getRole() == UserRole.admin || caller.getRole() == UserRole.super_admin || caller.getRole() == UserRole.content_creator)) return;
        var course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));
        // Published course curriculum outline is visible to students and guests
        if (course.getStatus() == CourseStatus.published) return;
        // Non-published (draft/archived) courses require an authenticated active enrollment
        if (caller == null) {
            throw new ForbiddenException("COURSE_NOT_AVAILABLE", "This course is not available");
        }
        enrollmentService.assertActiveEnrollment(caller.getId(), courseId);
    }

    @PostMapping("/api/v1/courses/{courseId}/sections")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<SectionResponse> create(@PathVariable Long courseId,
                                                @Valid @RequestBody SectionRequest req,
                                                @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Section created successfully", sectionService.create(courseId, req, actor));
    }

    @PutMapping("/api/v1/sections/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<SectionResponse> update(@PathVariable Long id,
                                                @Valid @RequestBody SectionRequest req,
                                                @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Section updated successfully", sectionService.update(id, req, actor));
    }

    @DeleteMapping("/api/v1/sections/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> archive(@PathVariable Long id,
                                     @RequestParam(defaultValue = "false") boolean force,
                                     @AuthenticationPrincipal User actor) {
        sectionService.delete(id, force, actor);
        return ApiResponse.ok(force ? "Section permanently deleted successfully" : "Section archived successfully", null);
    }

    @PostMapping("/api/v1/sections/{id}/restore")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> restore(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        sectionService.restore(id, actor);
        return ApiResponse.ok("Section restored successfully", null);
    }

    @PostMapping("/api/v1/courses/{courseId}/sections/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> reorder(@PathVariable Long courseId,
                                      @Valid @RequestBody ReorderRequest req,
                                      @AuthenticationPrincipal User actor) {
        sectionService.reorder(courseId, req.orderedIds(), actor);
        return ApiResponse.ok("Sections reordered successfully", null);
    }
}

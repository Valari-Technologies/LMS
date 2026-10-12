package com.onetutor.courses.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.courses.dto.CourseCardResponse;
import com.onetutor.courses.dto.CourseDetailResponse;
import com.onetutor.courses.dto.CourseRequest;
import com.onetutor.courses.service.CourseService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    /** Admin listing — all statuses, for the admin course management screen. */
    @GetMapping("/admin/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<PageResponse<CourseDetailResponse>> adminList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(courseService.adminList(status, PageRequest.of(page, size)));
    }

    /** Public catalog (SRS 23) — published courses only, search + category filter. */
    @GetMapping
    public ApiResponse<PageResponse<CourseCardResponse>> browse(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId) {
        return ApiResponse.ok(courseService.browseCatalog(search, categoryId, PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<CourseDetailResponse> get(@PathVariable Long id,
                                                  @AuthenticationPrincipal User caller) {
        return ApiResponse.ok(courseService.getDetail(id, caller));
    }

    @GetMapping("/{id}/preview")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> preview(@PathVariable Long id) {
        return ApiResponse.ok(courseService.preview(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> create(@Valid @RequestBody CourseRequest req,
                                                      @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course created successfully", courseService.create(req, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> update(@PathVariable Long id,
                                                      @Valid @RequestBody CourseRequest req,
                                                      @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course updated successfully", courseService.update(id, req, actor));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<CourseDetailResponse> publish(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course published successfully", courseService.publish(id, actor));
    }

    @PostMapping("/{id}/unpublish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<CourseDetailResponse> unpublish(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course unpublished successfully", courseService.unpublish(id, actor));
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> archive(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course archived successfully", courseService.archive(id, actor));
    }

    @PostMapping("/{id}/unarchive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> unarchive(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course unarchived successfully", courseService.unarchive(id, actor));
    }

    @PostMapping("/{id}/duplicate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CourseDetailResponse> duplicate(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course duplicated successfully", courseService.duplicate(id, actor));
    }

    @PostMapping("/{id}/approve-edits")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<CourseDetailResponse> approveEdits(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course edits approved and published successfully", courseService.approveEdits(id, actor));
    }

    @PostMapping("/{id}/reject-edits")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<CourseDetailResponse> rejectEdits(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Course edits rejected successfully", courseService.rejectEdits(id, actor));
    }
}

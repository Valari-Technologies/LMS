package com.onetutor.contents.controller;

import com.onetutor.contents.dto.*;
import com.onetutor.contents.service.ContentService;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.progress.service.ProgressService;
import com.onetutor.sections.repository.SectionRepository;
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
 * active enrollment in the owning course (SRS section 16/26), enforced via
 * EnrollmentService.assertActiveEnrollment below.
 */
@RestController
public class ContentController {

    private final ContentService contentService;
    private final SectionRepository sectionRepository;
    private final EnrollmentService enrollmentService;
    private final ProgressService progressService;

    public ContentController(ContentService contentService,
                              SectionRepository sectionRepository,
                              EnrollmentService enrollmentService,
                              ProgressService progressService) {
        this.contentService = contentService;
        this.sectionRepository = sectionRepository;
        this.enrollmentService = enrollmentService;
        this.progressService = progressService;
    }

    @GetMapping("/api/v1/sections/{sectionId}/contents")
    @Transactional(readOnly = true)
    public ApiResponse<List<ContentResponse>> listBySection(@PathVariable Long sectionId,
                                                            @RequestParam(defaultValue = "false") boolean includeArchived,
                                                            @AuthenticationPrincipal User caller) {
        assertCanView(sectionId, caller);
        List<ContentResponse> contents = contentService.listBySection(sectionId);
        if (caller == null || caller.getRole() == UserRole.student || !includeArchived) {
            // Students and default view only see active content items
            contents = contents.stream().filter(c -> "active".equalsIgnoreCase(c.status())).toList();
        }
        return ApiResponse.ok(contents);
    }

    /** Opening a content item records last-accessed for "Continue Learning" (SRS section 21), then returns it. */
    @GetMapping("/api/v1/contents/{contentId}")
    @Transactional(readOnly = true)
    public ApiResponse<ContentResponse> get(@PathVariable Long contentId,
                                             @AuthenticationPrincipal User caller) {
        var content = contentService.findOrThrow(contentId);
        assertCanView(content.getSection().getId(), caller);
        if (caller == null || caller.getRole() == UserRole.student) {
            if (content.getStatus() == com.onetutor.contents.entity.ContentStatus.pending_approval ||
                content.getSection().getStatus() == com.onetutor.sections.entity.SectionStatus.pending_approval) {
                throw new ForbiddenException("CONTENT_PENDING_APPROVAL", "This content is pending admin approval.");
            }
            if (caller != null) {
                progressService.assertContentUnlocked(content, caller);
                progressService.recordAccess(contentId, caller);
            }
        }
        return ApiResponse.ok(contentService.toResponse(content));
    }

    private void assertCanView(Long sectionId, User caller) {
        if (caller == null) {
            throw new ForbiddenException("AUTHENTICATION_REQUIRED", "Please log in to view course content");
        }
        if (caller.getRole() == UserRole.admin || caller.getRole() == UserRole.super_admin || caller.getRole() == UserRole.content_creator) return;
        var section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new NotFoundException("SECTION_NOT_FOUND", "Section not found"));
        var course = section.getCourse();
        enrollmentService.assertActiveEnrollment(caller.getId(), course.getId());
    }

    @PostMapping("/api/v1/sections/{sectionId}/contents")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ContentResponse> create(@PathVariable Long sectionId,
                                                @Valid @RequestBody ContentRequest req,
                                                @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Content created successfully", contentService.create(sectionId, req, actor));
    }

    @PutMapping("/api/v1/contents/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ContentResponse> update(@PathVariable Long id,
                                                @Valid @RequestBody ContentRequest req,
                                                @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Content updated successfully", contentService.update(id, req, actor));
    }

    @DeleteMapping("/api/v1/contents/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> delete(@PathVariable Long id,
                                    @RequestParam(defaultValue = "false") boolean force,
                                    @AuthenticationPrincipal User actor) {
        contentService.delete(id, force, actor);
        return ApiResponse.ok(force ? "Content permanently deleted successfully" : "Content archived successfully", null);
    }

    @PostMapping("/api/v1/contents/{id}/restore")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> restore(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        contentService.restore(id, actor);
        return ApiResponse.ok("Content restored successfully", null);
    }

    @PostMapping("/api/v1/sections/{sectionId}/contents/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> reorder(@PathVariable Long sectionId,
                                      @Valid @RequestBody ReorderRequest req,
                                      @AuthenticationPrincipal User actor) {
        contentService.reorder(sectionId, req.orderedIds(), actor);
        return ApiResponse.ok("Contents reordered successfully", null);
    }

    @GetMapping("/api/v1/contents/{id}/resources")
    public ApiResponse<List<ResourceResponse>> listResources(@PathVariable Long id,
                                                             @AuthenticationPrincipal User caller) {
        var content = contentService.findOrThrow(id);
        assertCanView(content.getSection().getId(), caller);
        return ApiResponse.ok(contentService.listResources(id));
    }

    @PostMapping("/api/v1/contents/{id}/resources")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ResourceResponse> addResource(@PathVariable Long id,
                                                       @Valid @RequestBody ResourceRequest req,
                                                       @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Resource added successfully", contentService.addResource(id, req, actor));
    }

    @PutMapping("/api/v1/contents/resources/{resourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ResourceResponse> updateResource(@PathVariable Long resourceId,
                                                        @Valid @RequestBody ResourceRequest req,
                                                        @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Resource updated successfully", contentService.updateResource(resourceId, req, actor));
    }

    @DeleteMapping("/api/v1/contents/resources/{resourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> deleteResource(@PathVariable Long resourceId,
                                            @AuthenticationPrincipal User actor) {
        contentService.deleteResource(resourceId, actor);
        return ApiResponse.ok("Resource deleted successfully", null);
    }

    @GetMapping("/api/v1/courses/{courseId}/resources")
    public ApiResponse<List<ResourceResponse>> listCourseResources(@PathVariable Long courseId,
                                                                   @AuthenticationPrincipal User caller) {
        if (caller == null) {
            throw new ForbiddenException("AUTHENTICATION_REQUIRED", "Please log in to view course resources");
        }
        if (caller.getRole() != UserRole.admin && caller.getRole() != UserRole.super_admin && caller.getRole() != UserRole.content_creator) {
            enrollmentService.assertActiveEnrollment(caller.getId(), courseId);
        }
        return ApiResponse.ok(contentService.listResourcesByCourse(courseId));
    }

    @GetMapping("/api/v1/contents/{id}/content-resources")
    public ApiResponse<List<ContentResourceResponse>> listContentResources(@PathVariable Long id,
                                                                           @AuthenticationPrincipal User caller) {
        var content = contentService.findOrThrow(id);
        assertCanView(content.getSection().getId(), caller);
        return ApiResponse.ok(contentService.listContentResources(id));
    }

    @PostMapping("/api/v1/contents/{id}/content-resources")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ContentResourceResponse> addContentResource(@PathVariable Long id,
                                                                   @Valid @RequestBody ContentResourceRequest req,
                                                                   @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Content resource added successfully", contentService.addContentResource(id, req, actor));
    }

    @PutMapping("/api/v1/contents/content-resources/{resourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ContentResourceResponse> updateContentResource(@PathVariable Long resourceId,
                                                                      @Valid @RequestBody ContentResourceRequest req,
                                                                      @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Content resource updated successfully", contentService.updateContentResource(resourceId, req, actor));
    }

    @DeleteMapping("/api/v1/contents/content-resources/{resourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> deleteContentResource(@PathVariable Long resourceId,
                                                   @AuthenticationPrincipal User actor) {
        contentService.deleteContentResource(resourceId, actor);
        return ApiResponse.ok("Content resource deleted successfully", null);
    }
}

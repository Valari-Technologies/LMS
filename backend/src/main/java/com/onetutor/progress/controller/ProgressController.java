package com.onetutor.progress.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.progress.dto.*;
import com.onetutor.progress.service.ProgressService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping("/my-progress")
    public ApiResponse<ContinueLearningResponse> myProgress(@AuthenticationPrincipal User student) {
        return ApiResponse.ok(progressService.continueLearning(student).orElse(null));
    }

    @GetMapping("/courses/{courseId}/progress")
    public ApiResponse<CourseProgressResponse> courseProgress(@PathVariable Long courseId,
                                                                 @AuthenticationPrincipal User student) {
        return ApiResponse.ok(progressService.getCourseProgress(courseId, student));
    }

    @GetMapping("/contents/{contentId}/progress")
    public ApiResponse<ContentProgressResponse> contentProgress(@PathVariable Long contentId,
                                                                    @AuthenticationPrincipal User student) {
        return ApiResponse.ok(progressService.getContentProgress(contentId, student));
    }

    @PutMapping("/contents/{contentId}/progress")
    public ApiResponse<ContentProgressResponse> updateProgress(@PathVariable Long contentId,
                                                                   @Valid @RequestBody ProgressUpdateRequest req,
                                                                   @AuthenticationPrincipal User student) {
        return ApiResponse.ok(progressService.updateProgress(contentId, req, student));
    }

    @PostMapping("/contents/{contentId}/session")
    public ApiResponse<ContentProgressResponse> startSession(@PathVariable Long contentId,
                                                             @AuthenticationPrincipal User student) {
        return ApiResponse.ok("Playback session started", progressService.startPlaybackSession(contentId, student));
    }

    @PostMapping("/contents/{contentId}/complete")
    public ApiResponse<ContentProgressResponse> complete(@PathVariable Long contentId,
                                                             @AuthenticationPrincipal User student) {
        return ApiResponse.ok("Content marked as complete", progressService.markComplete(contentId, student));
    }
}

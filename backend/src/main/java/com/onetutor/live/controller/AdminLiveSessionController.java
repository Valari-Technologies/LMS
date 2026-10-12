package com.onetutor.live.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.live.dto.*;
import com.onetutor.live.service.LiveSessionService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/live-sessions")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
public class AdminLiveSessionController {

    private final LiveSessionService liveSessionService;

    public AdminLiveSessionController(LiveSessionService liveSessionService) {
        this.liveSessionService = liveSessionService;
    }

    @GetMapping
    public ApiResponse<PageResponse<LiveSessionResponse>> list(
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(liveSessionService.adminList(courseId, status, PageRequest.of(page, size)));
    }

    @GetMapping("/upcoming-count")
    public ApiResponse<Long> upcomingCount() {
        return ApiResponse.ok(liveSessionService.getUpcomingAndLiveCount());
    }

    @PostMapping
    public ApiResponse<LiveSessionResponse> create(@Valid @RequestBody CreateLiveSessionRequest req,
                                                   @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Live session scheduled successfully", liveSessionService.create(req, actor));
    }

    @PutMapping("/{id}")
    public ApiResponse<LiveSessionResponse> update(@PathVariable Long id,
                                                   @RequestBody UpdateLiveSessionRequest req,
                                                   @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Live session updated successfully", liveSessionService.update(id, req, actor));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<LiveSessionResponse> complete(@PathVariable Long id,
                                                     @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Live session marked as completed", liveSessionService.complete(id, actor));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<LiveSessionResponse> cancel(@PathVariable Long id,
                                                   @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Live session cancelled successfully", liveSessionService.cancel(id, actor));
    }

    @PostMapping("/{id}/recording")
    public ApiResponse<SessionRecordingResponse> attachRecording(@PathVariable Long id,
                                                                 @Valid @RequestBody AttachRecordingRequest req,
                                                                 @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Recording attached successfully", liveSessionService.attachRecording(id, req, actor));
    }

    @PutMapping("/{sessionId}/recordings/{recordingId}")
    public ApiResponse<SessionRecordingResponse> updateRecording(@PathVariable Long sessionId,
                                                                 @PathVariable Long recordingId,
                                                                 @Valid @RequestBody AttachRecordingRequest req,
                                                                 @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Recording updated successfully", liveSessionService.updateRecording(sessionId, recordingId, req, actor));
    }

    @DeleteMapping("/{sessionId}/recordings/{recordingId}")
    public ApiResponse<Void> deleteRecording(@PathVariable Long sessionId,
                                            @PathVariable Long recordingId,
                                            @AuthenticationPrincipal User actor) {
        liveSessionService.deleteRecording(sessionId, recordingId, actor);
        return ApiResponse.ok("Recording deleted successfully", null);
    }
}

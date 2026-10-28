package com.onetutor.subtitles.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.contents.dto.ContentResponse;
import com.onetutor.contents.service.ContentService;
import com.onetutor.subtitles.service.SubtitleService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class SubtitleController {

    private final SubtitleService subtitleService;
    private final ContentService contentService;

    public SubtitleController(SubtitleService subtitleService, ContentService contentService) {
        this.subtitleService = subtitleService;
        this.contentService = contentService;
    }

    /**
     * Admin endpoint: Trigger Tamil→English subtitle generation for a video lesson.
     * Uses Whisper (cloud or local) to transcribe Tamil audio and produce English WebVTT.
     */
    @PostMapping("/admin/contents/{id}/generate-subtitles")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<ContentResponse> generateSubtitles(@PathVariable Long id) {
        subtitleService.triggerSubtitleGeneration(id);
        return ApiResponse.ok("Tamil→English subtitle generation job queued successfully",
                contentService.toResponse(contentService.findOrThrow(id)));
    }

    /**
     * Student/auto endpoint: Trigger subtitle generation when student opens a video lesson.
     * Same pipeline as admin trigger but accessible without admin role.
     */
    @PostMapping("/contents/{id}/auto-subtitles")
    public ApiResponse<Void> autoGenerateSubtitles(@PathVariable Long id) {
        subtitleService.triggerSubtitleGeneration(id);
        return ApiResponse.ok("Tamil→English subtitle generation job queued", null);
    }

    /**
     * Status polling endpoint: Returns current subtitle status for a content item.
     * Used by the frontend to poll until subtitleStatus == COMPLETED or FAILED.
     */
    @GetMapping({"/contents/{id}/subtitle-status", "/contents/{id}/subtitles/status"})
    public ApiResponse<SubtitleStatusResponse> getSubtitleStatus(@PathVariable Long id) {
        var content = contentService.findOrThrow(id);
        var resp = contentService.toResponse(content);
        return ApiResponse.ok(new SubtitleStatusResponse(
                resp.subtitleStatus(),
                resp.subtitleUrl(),
                resp.subtitleLanguage(),
                resp.subtitleSourceLanguage(),
                resp.subtitleError(),
                resp.subtitleProgress()
        ));
    }

    public record SubtitleStatusResponse(
            String status,
            String subtitleUrl,
            String outputLanguage,
            String sourceLanguage,
            String error,
            int progress
    ) {}
}

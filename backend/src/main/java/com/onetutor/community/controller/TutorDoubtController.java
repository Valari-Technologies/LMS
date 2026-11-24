package com.onetutor.community.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.community.dto.SendDoubtMessageRequest;
import com.onetutor.community.dto.TutorDoubtMessageResponse;
import com.onetutor.community.dto.TutorDoubtThreadResponse;
import com.onetutor.community.service.TutorDoubtService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/community")
public class TutorDoubtController {

    private final TutorDoubtService doubtService;

    public TutorDoubtController(TutorDoubtService doubtService) {
        this.doubtService = doubtService;
    }

    // ── Student Endpoints ────────────────────────────────────────────────────────

    /** Student: Load paginated 1-on-1 doubt messages for this course. */
    @GetMapping("/{courseId}/doubts/messages")
    public ApiResponse<PageResponse<TutorDoubtMessageResponse>> getStudentDoubtMessages(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.getStudentDoubtMessages(courseId, PageRequest.of(page, size), actor));
    }

    /** Student: Poll new doubt messages for this course. */
    @GetMapping("/{courseId}/doubts/messages/poll")
    public ApiResponse<List<TutorDoubtMessageResponse>> pollStudentDoubtMessages(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") Long afterId,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.pollStudentDoubtMessages(courseId, afterId, actor));
    }

    /** Student: Send a doubt message to course tutors. */
    @PostMapping("/{courseId}/doubts/messages")
    public ApiResponse<TutorDoubtMessageResponse> sendStudentDoubt(
            @PathVariable Long courseId,
            @Valid @RequestBody SendDoubtMessageRequest req,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Doubt submitted", doubtService.sendStudentDoubtMessage(courseId, req, actor));
    }

    /** Student: Mark doubt thread as read. */
    @PostMapping("/{courseId}/doubts/read")
    public ApiResponse<Void> markStudentDoubtRead(
            @PathVariable Long courseId,
            @RequestParam(required = false) Long messageId,
            @AuthenticationPrincipal User actor) {
        doubtService.markStudentDoubtRead(courseId, messageId, actor);
        return ApiResponse.ok("Marked as read", null);
    }

    // ── Tutor / Admin Endpoints ─────────────────────────────────────────────────

    /** Tutor / Admin: List all student doubt threads for this course. */
    @GetMapping("/{courseId}/doubts/threads")
    public ApiResponse<List<TutorDoubtThreadResponse>> getCourseDoubtThreads(
            @PathVariable Long courseId,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.getCourseDoubtThreads(courseId, actor));
    }

    /** Tutor / Admin: Load paginated messages for a student doubt thread. */
    @GetMapping("/{courseId}/doubts/students/{studentId}/messages")
    public ApiResponse<PageResponse<TutorDoubtMessageResponse>> getStudentThreadMessages(
            @PathVariable Long courseId,
            @PathVariable Long studentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.getStudentThreadMessages(courseId, studentId, PageRequest.of(page, size), actor));
    }

    /** Tutor / Admin: Poll messages for a student doubt thread. */
    @GetMapping("/{courseId}/doubts/students/{studentId}/messages/poll")
    public ApiResponse<List<TutorDoubtMessageResponse>> pollStudentThreadMessages(
            @PathVariable Long courseId,
            @PathVariable Long studentId,
            @RequestParam(defaultValue = "0") Long afterId,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.pollStudentThreadMessages(courseId, studentId, afterId, actor));
    }

    /** Tutor / Admin: Reply to a student doubt. */
    @PostMapping("/{courseId}/doubts/students/{studentId}/messages")
    public ApiResponse<TutorDoubtMessageResponse> replyToStudentDoubt(
            @PathVariable Long courseId,
            @PathVariable Long studentId,
            @Valid @RequestBody SendDoubtMessageRequest req,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Reply sent", doubtService.replyToStudentDoubt(courseId, studentId, req, actor));
    }

    /** Tutor / Admin: Mark a student thread read. */
    @PostMapping("/{courseId}/doubts/students/{studentId}/read")
    public ApiResponse<Void> markThreadReadByTutor(
            @PathVariable Long courseId,
            @PathVariable Long studentId,
            @RequestParam(required = false) Long messageId,
            @AuthenticationPrincipal User actor) {
        doubtService.markThreadReadByTutor(courseId, studentId, messageId, actor);
        return ApiResponse.ok("Marked as read", null);
    }

    // ── Common Endpoints ────────────────────────────────────────────────────────

    /** Total unread doubts count across courses for navbar/badge display. */
    @GetMapping("/doubts/unread-count")
    public ApiResponse<Map<String, Long>> getUnreadDoubtCount(
            @AuthenticationPrincipal User actor) {
        long count = doubtService.getUnreadDoubtCount(actor);
        return ApiResponse.ok(Map.of("unreadCount", count));
    }

    /** Tutor / Admin: List all student doubt threads across all courses (or filtered by courseId). */
    @GetMapping("/doubts/all-threads")
    public ApiResponse<List<TutorDoubtThreadResponse>> getAllDoubtThreads(
            @RequestParam(required = false) Long courseId,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(doubtService.getAllDoubtThreads(courseId, actor));
    }

    /** Direct KPI stats for doubt clearance (doubts asked, replied, pending). */
    @GetMapping("/doubts/stats")
    public ApiResponse<Map<String, Long>> getDoubtStats() {
        return ApiResponse.ok(doubtService.getDoubtStats());
    }
}

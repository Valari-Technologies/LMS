package com.onetutor.community.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.community.dto.CommunityMessageResponse;
import com.onetutor.community.dto.CourseCommunityStats;
import com.onetutor.community.dto.EditMessageRequest;
import com.onetutor.community.dto.SendMessageRequest;
import com.onetutor.community.service.CommunityService;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Community chat endpoints accessible by enrolled students and admins alike.
 * Enrollment check is enforced inside CommunityService for students.
 */
@RestController
@RequestMapping("/api/v1/community")
public class CommunityController {

    private final CommunityService communityService;

    public CommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    /** Enrolled-course chat list for the current student (admins/staff see all via /admin/community). */
    @GetMapping
    public ApiResponse<List<CourseCommunityStats>> overview(
            @AuthenticationPrincipal User actor) {
        if (actor.getRole() != UserRole.student) {
            return ApiResponse.ok(communityService.getAdminOverview(actor));
        }
        return ApiResponse.ok(communityService.getStudentOverview(actor));
    }

    /** Initial page load — returns paginated messages ascending by time (and marks chat as read). */
    @GetMapping("/{courseId}/messages")
    public ApiResponse<PageResponse<CommunityMessageResponse>> getMessages(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(communityService.getMessages(courseId, PageRequest.of(page, size), actor));
    }

    /** Polling — returns messages with id > afterId (for live updates). */
    @GetMapping("/{courseId}/messages/poll")
    public ApiResponse<List<CommunityMessageResponse>> pollMessages(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") Long afterId,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok(communityService.pollMessages(courseId, afterId, actor));
    }

    /** Send a new message (text or media). */
    @PostMapping("/{courseId}/messages")
    public ApiResponse<CommunityMessageResponse> sendMessage(
            @PathVariable Long courseId,
            @Valid @RequestBody SendMessageRequest req,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Message sent", communityService.sendMessage(courseId, req, actor));
    }

    /** Edit own message within 10 minutes of sending (WhatsApp-style). */
    @PutMapping("/{courseId}/messages/{messageId}")
    public ApiResponse<CommunityMessageResponse> editMessage(
            @PathVariable Long courseId,
            @PathVariable Long messageId,
            @Valid @RequestBody EditMessageRequest req,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Message edited", communityService.editMessage(courseId, messageId, req, actor));
    }

    /** Soft-delete a message (own message for students, any for admins). */
    @DeleteMapping("/{courseId}/messages/{messageId}")
    public ApiResponse<Void> deleteMessage(
            @PathVariable Long courseId,
            @PathVariable Long messageId,
            @AuthenticationPrincipal User actor) {
        communityService.deleteMessage(courseId, messageId, actor);
        return ApiResponse.ok("Message deleted", null);
    }

    /** Mark chat as read up to a message ID (or latest). */
    @PostMapping("/{courseId}/read")
    public ApiResponse<Void> markRead(
            @PathVariable Long courseId,
            @RequestParam(required = false) Long messageId,
            @AuthenticationPrincipal User actor) {
        communityService.markAsRead(courseId, messageId, actor);
        return ApiResponse.ok("Marked as read", null);
    }

    /** Check current student's status (active vs disabled) in this course community. */
    @GetMapping("/{courseId}/my-status")
    public ApiResponse<Map<String, Boolean>> getMyStatus(
            @PathVariable Long courseId,
            @AuthenticationPrincipal User actor) {
        boolean disabled = communityService.isStudentDisabledInCommunity(courseId, actor);
        return ApiResponse.ok(Map.of("isDisabled", disabled));
    }

    /** Returns count of course communities that have unread messages (WhatsApp navbar style). */
    @GetMapping("/unread-chats")
    public ApiResponse<Map<String, Long>> getUnreadChatCount(@AuthenticationPrincipal User actor) {
        long count = communityService.getUnreadChatCount(actor);
        return ApiResponse.ok(Map.of("unreadChatCount", count));
    }
}

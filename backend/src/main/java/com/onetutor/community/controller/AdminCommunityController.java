package com.onetutor.community.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.community.dto.CourseCommunityStats;
import com.onetutor.community.service.CommunityService;
import com.onetutor.users.entity.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin-only community overview endpoint.
 * All per-course message operations are handled by CommunityController (admins bypass enrollment check there).
 */
@RestController
@RequestMapping("/api/v1/admin/community")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
public class AdminCommunityController {

    private final CommunityService communityService;

    public AdminCommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    /** Returns all courses with their message counts and admin unread counts — used for the admin community sidebar. */
    @GetMapping
    public ApiResponse<List<CourseCommunityStats>> overview(@AuthenticationPrincipal User actor) {
        return ApiResponse.ok(communityService.getAdminOverview(actor));
    }

    /** Returns count of course communities that have unread messages for admin. */
    @GetMapping("/unread-chats")
    public ApiResponse<Map<String, Long>> getUnreadChatCount(@AuthenticationPrincipal User actor) {
        long count = communityService.getUnreadChatCount(actor);
        return ApiResponse.ok(Map.of("unreadChatCount", count));
    }

    /** Returns all enrolled students for a course community with their active/disabled status. */
    @GetMapping("/{courseId}/members")
    public ApiResponse<List<com.onetutor.community.dto.CommunityMemberResponse>> getCommunityMembers(
            @PathVariable Long courseId) {
        return ApiResponse.ok(communityService.getCommunityMembers(courseId));
    }

    /** Toggle a student's access status in a course community (active vs disabled). */
    @PutMapping("/{courseId}/members/{userId}/status")
    public ApiResponse<com.onetutor.community.dto.CommunityMemberResponse> toggleCommunityMemberStatus(
            @PathVariable Long courseId,
            @PathVariable Long userId,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal User actor) {
        boolean isDisabled = Boolean.TRUE.equals(body.get("isDisabled"));
        return ApiResponse.ok("Member status updated", communityService.toggleCommunityMemberStatus(courseId, userId, isDisabled, actor));
    }
}

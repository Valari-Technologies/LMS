package com.onetutor.notifications.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.notifications.dto.AdminBroadcastRequest;
import com.onetutor.notifications.dto.BroadcastResponse;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
public class AdminNotificationController {

    private final NotificationService notificationService;

    public AdminNotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/broadcast")
    public ApiResponse<BroadcastResponse> broadcast(
            @AuthenticationPrincipal User admin,
            @Valid @RequestBody AdminBroadcastRequest req) {
        BroadcastResponse response = notificationService.broadcast(req, admin);
        return ApiResponse.ok("Notification broadcast sent successfully", response);
    }

    @PostMapping("/broadcast/{id}/resend")
    public ApiResponse<BroadcastResponse> resendBroadcast(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id) {
        BroadcastResponse response = notificationService.resendBroadcast(id, admin);
        return ApiResponse.ok("Notification broadcast resent successfully", response);
    }

    @GetMapping("/broadcasts")
    public ApiResponse<PageResponse<BroadcastResponse>> listBroadcasts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(notificationService.listBroadcasts(PageRequest.of(page, size)));
    }
}

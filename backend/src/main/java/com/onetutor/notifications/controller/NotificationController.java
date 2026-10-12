package com.onetutor.notifications.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.notifications.dto.NotificationResponse;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ApiResponse<PageResponse<NotificationResponse>> list(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(notificationService.listForUser(user, PageRequest.of(page, size)));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> unreadCount(@AuthenticationPrincipal User user) {
        return ApiResponse.ok(Map.of("unreadCount", notificationService.getUnreadCount(user)));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id, @AuthenticationPrincipal User user) {
        notificationService.markAsRead(id, user);
        return ApiResponse.ok("Notification marked as read", null);
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> markAllRead(@AuthenticationPrincipal User user) {
        notificationService.markAllAsRead(user);
        return ApiResponse.ok("All notifications marked as read", null);
    }

    @PostMapping("/fcm-token")
    public ApiResponse<Void> registerFcmToken(
            @AuthenticationPrincipal User user,
            @jakarta.validation.Valid @RequestBody com.onetutor.notifications.dto.RegisterFcmTokenRequest req) {
        notificationService.registerFcmToken(user, req.token(), req.deviceType());
        return ApiResponse.ok("FCM token registered successfully", null);
    }

    @DeleteMapping("/fcm-token")
    public ApiResponse<Void> unregisterFcmToken(
            @AuthenticationPrincipal User user,
            @RequestParam String token) {
        notificationService.unregisterFcmToken(user, token);
        return ApiResponse.ok("FCM token unregistered successfully", null);
    }
}

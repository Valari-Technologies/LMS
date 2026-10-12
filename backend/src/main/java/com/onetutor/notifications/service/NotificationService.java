package com.onetutor.notifications.service;

import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.notifications.dto.AdminBroadcastRequest;
import com.onetutor.notifications.dto.BroadcastResponse;
import com.onetutor.notifications.dto.NotificationResponse;
import com.onetutor.notifications.entity.BroadcastNotification;
import com.onetutor.notifications.entity.FcmToken;
import com.onetutor.notifications.entity.Notification;
import com.onetutor.notifications.entity.NotificationType;
import com.onetutor.notifications.repository.BroadcastNotificationRepository;
import com.onetutor.notifications.repository.FcmTokenRepository;
import com.onetutor.notifications.repository.NotificationRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final FcmTokenRepository fcmTokenRepository;
    private final BroadcastNotificationRepository broadcastRepository;
    private final UserRepository userRepository;
    private final FirebaseMessagingService firebaseMessagingService;

    public NotificationService(NotificationRepository notificationRepository,
                               FcmTokenRepository fcmTokenRepository,
                               BroadcastNotificationRepository broadcastRepository,
                               UserRepository userRepository,
                               FirebaseMessagingService firebaseMessagingService) {
        this.notificationRepository = notificationRepository;
        this.fcmTokenRepository = fcmTokenRepository;
        this.broadcastRepository = broadcastRepository;
        this.userRepository = userRepository;
        this.firebaseMessagingService = firebaseMessagingService;
    }

    // ── In-App & Push Notification Sending ─────────────────────────────────────

    @Transactional
    public void notify(User user, String title, String message, NotificationType type) {
        notify(user, title, message, type, null, null);
    }

    @Transactional
    public void notify(User user, String title, String message, NotificationType type, String imageUrl, String linkUrl) {
        if (user == null) return;

        // 1. Save in-app notification to database
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setType(type);
        notification.setImageUrl(imageUrl);
        notification.setLinkUrl(linkUrl);
        notification.setRead(false);
        notificationRepository.save(notification);

        // 2. Dispatch FCM Push Notification to user's registered devices
        try {
            List<String> tokens = fcmTokenRepository.findTokensByUserId(user.getId());
            if (!tokens.isEmpty()) {
                Map<String, String> data = new HashMap<>();
                data.put("type", type.name());
                if (linkUrl != null && !linkUrl.isBlank()) data.put("linkUrl", linkUrl);
                data.put("notificationId", String.valueOf(notification.getId()));

                firebaseMessagingService.sendMulticast(tokens, title, message, imageUrl, linkUrl, data);
            }
        } catch (Exception e) {
            log.warn("[Notifications] Failed to dispatch FCM push to user {}: {}", user.getId(), e.getMessage());
        }
    }

    @Transactional
    public void notifyUsers(List<User> users, String title, String message, NotificationType type, String imageUrl, String linkUrl) {
        if (users == null || users.isEmpty()) return;

        // Deduplicate users
        Map<Long, User> uniqueUsers = new HashMap<>();
        for (User u : users) {
            if (u != null && u.getId() != null) {
                uniqueUsers.put(u.getId(), u);
            }
        }

        if (uniqueUsers.isEmpty()) return;

        // 1. Save in-app notifications in batch
        List<Notification> inAppNotifications = new ArrayList<>();
        for (User user : uniqueUsers.values()) {
            Notification notification = new Notification();
            notification.setUser(user);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setType(type);
            notification.setImageUrl(imageUrl);
            notification.setLinkUrl(linkUrl);
            notification.setRead(false);
            inAppNotifications.add(notification);
        }
        notificationRepository.saveAll(inAppNotifications);

        // 2. Dispatch FCM Push Notification in multicast
        try {
            List<String> tokens = fcmTokenRepository.findTokensByUserIds(uniqueUsers.keySet());
            if (!tokens.isEmpty()) {
                Map<String, String> data = new HashMap<>();
                data.put("type", type.name());
                if (linkUrl != null && !linkUrl.isBlank()) data.put("linkUrl", linkUrl);

                firebaseMessagingService.sendMulticast(tokens, title, message, imageUrl, linkUrl, data);
            }
        } catch (Exception e) {
            log.warn("[Notifications] Failed to dispatch FCM multicast push: {}", e.getMessage());
        }
    }

    // ── Admin Broadcast Center ──────────────────────────────────────────────────

    @Transactional
    public BroadcastResponse broadcast(AdminBroadcastRequest req, User admin) {
        String targetRole = req.targetRole() != null ? req.targetRole().trim().toUpperCase() : "ALL";

        List<User> recipients;
        if ("STUDENT".equalsIgnoreCase(targetRole)) {
            recipients = userRepository.findByRoleAndStatus(UserRole.student, UserStatus.active);
        } else if ("ADMIN".equalsIgnoreCase(targetRole) || "SUPER_ADMIN".equalsIgnoreCase(targetRole)) {
            recipients = userRepository.findByRoleInAndStatus(List.of(UserRole.super_admin, UserRole.admin), UserStatus.active);
        } else {
            recipients = userRepository.findByStatus(UserStatus.active);
        }

        NotificationType type;
        try {
            type = req.type() != null ? NotificationType.valueOf(req.type().toUpperCase()) : NotificationType.SYSTEM;
        } catch (IllegalArgumentException e) {
            type = NotificationType.SYSTEM;
        }

        // 1. Save in-app notifications
        if (!recipients.isEmpty()) {
            List<Notification> inAppList = new ArrayList<>();
            for (User u : recipients) {
                Notification n = new Notification();
                n.setUser(u);
                n.setTitle(req.title().trim());
                n.setMessage(req.message().trim());
                n.setType(type);
                n.setImageUrl(req.imageUrl());
                n.setLinkUrl(req.linkUrl());
                n.setRead(false);
                inAppList.add(n);
            }
            notificationRepository.saveAll(inAppList);
        }

        // 2. Dispatch FCM Push to all registered device tokens
        int successCount = 0;
        int failureCount = 0;
        try {
            List<String> tokens;
            if ("STUDENT".equalsIgnoreCase(targetRole) || "ADMIN".equalsIgnoreCase(targetRole)) {
                List<Long> userIds = recipients.stream().map(User::getId).toList();
                tokens = fcmTokenRepository.findTokensByUserIds(userIds);
            } else {
                tokens = fcmTokenRepository.findAllTokens();
            }

            if (!tokens.isEmpty()) {
                Map<String, String> data = new HashMap<>();
                data.put("type", type.name());
                if (req.linkUrl() != null && !req.linkUrl().isBlank()) data.put("linkUrl", req.linkUrl().trim());

                FirebaseMessagingService.FcmSendResult result =
                        firebaseMessagingService.sendMulticast(tokens, req.title().trim(), req.message().trim(),
                                req.imageUrl(), req.linkUrl(), data);
                successCount = result.successCount();
                failureCount = result.failureCount();
            }
        } catch (Exception e) {
            log.error("[Notifications] Broadcast FCM dispatch error: {}", e.getMessage());
        }

        // 3. Log broadcast event
        BroadcastNotification broadcast = new BroadcastNotification();
        broadcast.setTitle(req.title().trim());
        broadcast.setMessage(req.message().trim());
        broadcast.setType(type.name());
        broadcast.setImageUrl(req.imageUrl());
        broadcast.setLinkUrl(req.linkUrl());
        broadcast.setTargetRole(targetRole);
        broadcast.setRecipientCount(recipients.size());
        broadcast.setFcmSuccessCount(successCount);
        broadcast.setFcmFailureCount(failureCount);
        broadcast.setSentBy(admin);

        BroadcastNotification saved = broadcastRepository.save(broadcast);
        return BroadcastResponse.from(saved);
    }

    public BroadcastResponse resendBroadcast(Long broadcastId, User admin) {
        BroadcastNotification original = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new NotFoundException("BROADCAST_NOT_FOUND", "Broadcast notification not found with id: " + broadcastId));

        AdminBroadcastRequest req = new AdminBroadcastRequest(
                original.getTitle(),
                original.getMessage(),
                original.getType(),
                original.getImageUrl(),
                original.getLinkUrl(),
                original.getTargetRole()
        );
        return broadcast(req, admin);
    }

    @Transactional(readOnly = true)
    public PageResponse<BroadcastResponse> listBroadcasts(Pageable pageable) {
        Page<BroadcastNotification> page = broadcastRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.from(page.map(BroadcastResponse::from));
    }

    // ── Device Token Registration ───────────────────────────────────────────────

    @Transactional
    public void registerFcmToken(User user, String token, String deviceType) {
        if (token == null || token.isBlank()) return;
        String cleanToken = token.trim();
        String type = (deviceType != null && !deviceType.isBlank()) ? deviceType.trim() : "web";

        Optional<FcmToken> existingOpt = fcmTokenRepository.findByToken(cleanToken);
        if (existingOpt.isPresent()) {
            FcmToken existing = existingOpt.get();
            existing.setUser(user);
            existing.setDeviceType(type);
            fcmTokenRepository.save(existing);
        } else {
            FcmToken fcmToken = new FcmToken();
            fcmToken.setUser(user);
            fcmToken.setToken(cleanToken);
            fcmToken.setDeviceType(type);
            fcmTokenRepository.save(fcmToken);
        }
    }

    @Transactional
    public void unregisterFcmToken(User user, String token) {
        if (token == null || token.isBlank()) return;
        if (user != null) {
            fcmTokenRepository.deleteByUserIdAndToken(user.getId(), token.trim());
        } else {
            fcmTokenRepository.deleteByToken(token.trim());
        }
    }

    // ── In-App Reading & Queries ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> listForUser(User user, Pageable pageable) {
        Page<Notification> page = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable);
        return PageResponse.from(page.map(NotificationResponse::from));
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(User user) {
        return notificationRepository.countByUserIdAndReadFalse(user.getId());
    }

    @Transactional
    public void markAsRead(Long id, User user) {
        Notification notification = notificationRepository.findById(id)
                .filter(n -> n.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new NotFoundException("NOTIFICATION_NOT_FOUND", "Notification not found"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(User user) {
        notificationRepository.markAllReadForUser(user.getId());
    }

    @Transactional
    public void deleteCommunityNotifications(Long userId, String linkUrl) {
        if (userId != null && linkUrl != null) {
            notificationRepository.deleteCommunityNotificationsForUserAndLink(userId, linkUrl);
        }
    }
}

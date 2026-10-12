package com.onetutor.notifications.dto;

import com.onetutor.notifications.entity.Notification;

import java.time.Instant;

public record NotificationResponse(
        Long id,
        String title,
        String message,
        String type,
        boolean read,
        String imageUrl,
        String linkUrl,
        Instant createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getTitle(),
                n.getMessage(),
                n.getType().name(),
                n.isRead(),
                n.getImageUrl(),
                n.getLinkUrl(),
                n.getCreatedAt()
        );
    }
}

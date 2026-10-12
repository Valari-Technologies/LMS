package com.onetutor.notifications.dto;

import com.onetutor.notifications.entity.BroadcastNotification;

import java.time.Instant;

public record BroadcastResponse(
        Long id,
        String title,
        String message,
        String type,
        String imageUrl,
        String linkUrl,
        String targetRole,
        int recipientCount,
        int fcmSuccessCount,
        int fcmFailureCount,
        String sentByName,
        Instant createdAt
) {
    public static BroadcastResponse from(BroadcastNotification b) {
        return new BroadcastResponse(
                b.getId(),
                b.getTitle(),
                b.getMessage(),
                b.getType(),
                b.getImageUrl(),
                b.getLinkUrl(),
                b.getTargetRole(),
                b.getRecipientCount(),
                b.getFcmSuccessCount(),
                b.getFcmFailureCount(),
                b.getSentBy() != null ? b.getSentBy().getName() : "System Admin",
                b.getCreatedAt()
        );
    }
}

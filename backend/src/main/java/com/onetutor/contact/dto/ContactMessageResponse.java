package com.onetutor.contact.dto;

import com.onetutor.contact.entity.ContactMessage;
import java.time.Instant;

public record ContactMessageResponse(
        Long id,
        String name,
        String email,
        String subject,
        String message,
        String status,
        Long userId,
        String ipAddress,
        String userAgent,
        String replyMessage,
        Long repliedBy,
        String repliedByName,
        Instant repliedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContactMessageResponse from(ContactMessage msg) {
        return new ContactMessageResponse(
                msg.getId(),
                msg.getName(),
                msg.getEmail(),
                msg.getSubject(),
                msg.getMessage(),
                msg.getStatus(),
                msg.getUser() != null ? msg.getUser().getId() : null,
                msg.getIpAddress(),
                msg.getUserAgent(),
                msg.getReplyMessage(),
                msg.getRepliedBy(),
                msg.getRepliedByName(),
                msg.getRepliedAt(),
                msg.getCreatedAt(),
                msg.getUpdatedAt()
        );
    }
}

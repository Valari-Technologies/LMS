package com.onetutor.community.dto;

import java.time.Instant;

public record TutorDoubtThreadResponse(
        Long studentId,
        String studentName,
        String studentEmail,
        String studentAvatar,
        Long courseId,
        String courseName,
        String lastMessage,
        String lastMessageType,
        String lastSenderRole,
        Instant lastMessageTime,
        long unreadCount,
        String status // "waiting_for_tutor" | "answered"
) {}

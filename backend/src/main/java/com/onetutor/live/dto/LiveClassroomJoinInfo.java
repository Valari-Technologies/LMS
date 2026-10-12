package com.onetutor.live.dto;

import java.time.Instant;

public record LiveClassroomJoinInfo(
        Long sessionId,
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        String title,
        String description,
        Instant scheduledAt,
        Instant endTime,
        String meetingUrl,
        String roomName,
        String domain,
        String userDisplayName,
        String userEmail,
        boolean isModerator,
        String status
) {}

package com.onetutor.live.dto;

import java.time.Instant;

public record UpdateLiveSessionRequest(
        Long courseId,
        Long batchId,
        String title,
        String description,
        Instant scheduledAt,
        Instant endTime,
        String meetingUrl,
        String status
) {}

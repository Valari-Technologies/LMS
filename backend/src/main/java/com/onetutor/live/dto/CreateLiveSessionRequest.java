package com.onetutor.live.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record CreateLiveSessionRequest(
        @NotNull(message = "Course ID is required")
        Long courseId,

        Long batchId,

        Long sectionId,

        @NotBlank(message = "Title is required")
        String title,

        String description,

        @NotNull(message = "Scheduled time is required")
        Instant scheduledAt,

        Instant endTime,

        String meetingUrl
) {}

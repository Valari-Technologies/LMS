package com.onetutor.notifications.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminBroadcastRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 200, message = "Title must not exceed 200 characters")
        String title,

        @NotBlank(message = "Message description is required")
        String message,

        String type, // SYSTEM, ANNOUNCEMENT, COURSE, LIVE_CLASS

        String imageUrl,

        String linkUrl,

        String targetRole // ALL, student, admin
) {}

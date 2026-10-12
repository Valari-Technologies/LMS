package com.onetutor.notifications.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterFcmTokenRequest(
        @NotBlank(message = "Token is required")
        String token,
        String deviceType
) {}

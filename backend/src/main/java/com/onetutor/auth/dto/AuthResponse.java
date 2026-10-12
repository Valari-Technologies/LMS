package com.onetutor.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        UserSummary user
) {}

package com.onetutor.users.dto;

public record UpdateProfileRequest(
        String name,
        String profileImage,
        String currentPassword,
        String newPassword
) {}

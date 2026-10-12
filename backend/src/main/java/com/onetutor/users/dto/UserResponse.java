package com.onetutor.users.dto;

import com.onetutor.users.entity.User;

import java.time.Instant;

public record UserResponse(
        Long id,
        String name,
        String email,
        String role,
        String status,
        String profileImage,
        boolean emailVerified,
        Instant createdAt,
        Instant lastActiveAt,
        String permissions
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getProfileImage(),
                user.isEmailVerified(),
                user.getCreatedAt(),
                user.getLastActiveAt(),
                user.getPermissions()
        );
    }
}

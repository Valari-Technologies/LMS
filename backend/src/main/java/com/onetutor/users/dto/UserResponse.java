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
        String displayName = user.getName();
        if (displayName == null || displayName.equalsIgnoreCase("Super Admin")
                || displayName.toLowerCase().contains("super admin")
                || (user.getRole() == com.onetutor.users.entity.UserRole.super_admin && "Admin".equalsIgnoreCase(displayName))) {
            displayName = "One Tutor";
        }
        return new UserResponse(
                user.getId(),
                displayName,
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

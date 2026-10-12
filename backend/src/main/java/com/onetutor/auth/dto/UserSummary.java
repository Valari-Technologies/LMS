package com.onetutor.auth.dto;

public record UserSummary(
        Long id,
        String name,
        String email,
        String role,
        boolean emailVerified,
        String profileImage,
        String permissions
) {
    public UserSummary(Long id, String name, String email, String role, boolean emailVerified, String profileImage) {
        this(id, name, email, role, emailVerified, profileImage, null);
    }
}

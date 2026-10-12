package com.onetutor.community.dto;

import com.onetutor.users.entity.User;

import java.time.Instant;

public record CommunityMemberResponse(
        Long userId,
        String name,
        String email,
        String avatar,
        String role,
        Instant enrolledAt,
        boolean isDisabled
) {
    public static CommunityMemberResponse of(User user, Instant enrolledAt, boolean isDisabled) {
        return new CommunityMemberResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getProfileImage(),
                user.getRole() != null ? user.getRole().name() : "student",
                enrolledAt,
                isDisabled
        );
    }
}

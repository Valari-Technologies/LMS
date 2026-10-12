package com.onetutor.reviews.dto;

import java.time.Instant;

public record ReviewResponse(
        Long id,
        Long courseId,
        String courseName,
        Long studentId,
        String studentName,
        String studentEmail,
        String studentAvatar,
        Integer rating,
        String comment,
        String status,
        Instant createdAt,
        Instant updatedAt,
        boolean canEdit
) {}

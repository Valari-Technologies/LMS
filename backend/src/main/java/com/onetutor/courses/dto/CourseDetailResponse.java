package com.onetutor.courses.dto;

import java.time.Instant;

public record CourseDetailResponse(
        Long id,
        String name,
        String shortDesc,
        String description,
        String thumbnail,
        Long categoryId,
        String categoryName,
        String level,
        String duration,
        String language,
        String prerequisites,
        String learningOutcomes,
        String status,
        int version,
        boolean sequentialVideoEnabled,
        boolean requireVideoCompletion,
        boolean sequentialLessonUnlocking,
        boolean pauseOnTabInactive,
        int videoCompletionThreshold,
        int progressSaveInterval,
        boolean pendingApproval,
        String pendingEdits,
        Instant createdAt,
        Instant updatedAt,
        String pricingType,
        Double price,
        String currency,
        String subscriptionPeriod
) {
    public CourseDetailResponse(
            Long id, String name, String shortDesc, String description,
            String thumbnail, Long categoryId, String categoryName,
            String level, String duration, String language,
            String prerequisites, String learningOutcomes,
            String status, int version,
            boolean sequentialVideoEnabled, boolean requireVideoCompletion,
            boolean sequentialLessonUnlocking, boolean pauseOnTabInactive,
            int videoCompletionThreshold, int progressSaveInterval,
            boolean pendingApproval, String pendingEdits,
            Instant createdAt, Instant updatedAt) {
        this(id, name, shortDesc, description, thumbnail, categoryId, categoryName,
             level, duration, language, prerequisites, learningOutcomes, status, version,
             sequentialVideoEnabled, requireVideoCompletion, sequentialLessonUnlocking,
             pauseOnTabInactive, videoCompletionThreshold, progressSaveInterval,
             pendingApproval, pendingEdits, createdAt, updatedAt,
             "free", 0.0, "INR", "lifetime");
    }
}

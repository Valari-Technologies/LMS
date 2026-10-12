package com.onetutor.courses.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CourseRequest(
        @NotBlank(message = "Course name is required")
        @Size(max = 200)
        String name,

        @Size(max = 500)
        String shortDesc,

        String description,

        String thumbnail,

        @NotNull(message = "Category is required")
        Long categoryId,

        String level,
        String duration,
        String language,
        String prerequisites,
        String learningOutcomes,

        Boolean sequentialVideoEnabled,
        Boolean requireVideoCompletion,
        Boolean sequentialLessonUnlocking,
        Boolean pauseOnTabInactive,
        Integer videoCompletionThreshold,
        Integer progressSaveInterval,

        String pricingType,
        Double price,
        String currency,
        String subscriptionPeriod
) {
    public CourseRequest(
            String name, String shortDesc, String description, String thumbnail,
            Long categoryId, String level, String duration, String language,
            String prerequisites, String learningOutcomes,
            Boolean sequentialVideoEnabled, Boolean requireVideoCompletion,
            Boolean sequentialLessonUnlocking, Boolean pauseOnTabInactive,
            Integer videoCompletionThreshold, Integer progressSaveInterval) {
        this(name, shortDesc, description, thumbnail, categoryId, level, duration, language,
             prerequisites, learningOutcomes, sequentialVideoEnabled, requireVideoCompletion,
             sequentialLessonUnlocking, pauseOnTabInactive, videoCompletionThreshold, progressSaveInterval,
             "free", 0.0, "INR", "lifetime");
    }
}

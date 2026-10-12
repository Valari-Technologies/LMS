package com.onetutor.assessments.dto;

import java.time.Instant;
import java.util.List;

public record AssessmentAdminResponse(
        Long id,
        Long contentId,
        boolean enabled,
        boolean required,
        int passPercentage,
        String completionMode,
        boolean timerEnabled,
        int timerDurationMinutes,
        boolean randomizeQuestions,
        boolean randomizeOptions,
        List<AssessmentQuestionAdminDto> questions,
        Instant createdAt,
        Instant updatedAt
) {}

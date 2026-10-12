package com.onetutor.assessments.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AssessmentSaveRequest(
        boolean enabled,
        boolean required,
        @Min(value = 0, message = "Pass percentage must be at least 0")
        @Max(value = 100, message = "Pass percentage cannot exceed 100")
        int passPercentage,
        String completionMode, // PASS_ASSESSMENT, SUBMIT_ASSESSMENT
        boolean timerEnabled,
        @Min(value = 1, message = "Timer duration must be at least 1 minute")
        int timerDurationMinutes,
        boolean randomizeQuestions,
        boolean randomizeOptions,
        @NotNull @Valid List<AssessmentQuestionAdminDto> questions
) {}

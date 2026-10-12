package com.onetutor.assessments.dto;

import java.util.List;

public record AssessmentStudentResponse(
        Long id,
        Long contentId,
        String lessonTitle,
        boolean enabled,
        boolean required,
        int passPercentage,
        String completionMode,
        boolean timerEnabled,
        int timerDurationMinutes,
        int totalQuestions,
        List<QuestionStudentDto> questions,
        AssessmentSummaryDto userStatus
) {}

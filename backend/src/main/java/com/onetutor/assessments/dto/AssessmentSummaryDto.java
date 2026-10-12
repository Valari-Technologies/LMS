package com.onetutor.assessments.dto;

public record AssessmentSummaryDto(
        boolean hasAssessment,
        boolean required,
        boolean completed,
        boolean passed,
        int totalQuestions,
        int bestScore,
        double bestPercentage,
        int passPercentage,
        int attemptsCount,
        Long activeAttemptId,
        String activeAttemptStatus,
        Long latestAttemptId
) {}

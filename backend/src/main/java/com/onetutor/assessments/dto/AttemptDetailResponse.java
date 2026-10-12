package com.onetutor.assessments.dto;

import java.time.Instant;
import java.util.Map;

public record AttemptDetailResponse(
        Long attemptId,
        Long assessmentId,
        Long contentId,
        String status, // IN_PROGRESS, COMPLETED, FAILED, TERMINATED
        String terminatedReason,
        int attemptNumber,
        Instant startedAt,
        Instant submittedAt,
        long timeRemainingSeconds,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        int obtainedMarks,
        double percentage,
        boolean passed,
        int passPercentage,
        Map<Long, String> selectedAnswers // map of questionId -> selectedOption ('A'/'B'/'C'/'D')
) {}

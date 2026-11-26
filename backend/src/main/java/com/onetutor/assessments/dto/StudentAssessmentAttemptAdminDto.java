package com.onetutor.assessments.dto;

import java.time.Instant;

public record StudentAssessmentAttemptAdminDto(
        Long attemptId,
        Long studentId,
        String studentName,
        String studentEmail,
        String studentProfileImage,
        Long batchId,
        String batchName,
        Long assessmentId,
        Long contentId,
        String status,
        String terminatedReason,
        int attemptNumber,
        Instant startedAt,
        Instant submittedAt,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        int obtainedMarks,
        double percentage,
        boolean passed,
        double passPercentage,
        Long durationSeconds
) {}

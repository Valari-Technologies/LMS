package com.onetutor.admin.dto;

import java.time.Instant;

public record AdminStudentProgressResponse(
        Long studentId,
        String studentName,
        String studentEmail,
        Long courseId,
        String courseName,
        double progressPercent,
        long completedContents,
        long totalContents,
        Instant enrolledAt,
        Instant lastAccessedAt
) {}

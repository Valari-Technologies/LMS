package com.onetutor.users.dto;

import java.time.Instant;
import java.util.List;

public record StudentDetailResponse(
        Long id,
        String name,
        String email,
        String status,
        String profileImage,
        boolean emailVerified,
        Instant createdAt,
        int totalEnrollments,
        List<EnrolledCourseSummary> enrolledCourses
) {
    public record EnrolledCourseSummary(
            Long enrollmentId,
            Long courseId,
            String courseName,
            String categoryName,
            String status,
            Instant enrolledAt,
            double progressPercent,
            Instant lastAccessedAt
    ) {}
}

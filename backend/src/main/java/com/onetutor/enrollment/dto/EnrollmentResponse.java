package com.onetutor.enrollment.dto;

import java.time.Instant;

public record EnrollmentResponse(
        Long id,
        Long courseId,
        String courseName,
        String courseThumbnail,
        String status,
        Instant enrolledAt,
        Long batchId,
        String batchName,
        String batchCode,
        String pricingType,
        Double amountPaid
) {
    public EnrollmentResponse(Long id, Long courseId, String courseName, String courseThumbnail, String status, Instant enrolledAt) {
        this(id, courseId, courseName, courseThumbnail, status, enrolledAt, null, null, null, "free", 0.0);
    }

    public EnrollmentResponse(Long id, Long courseId, String courseName, String courseThumbnail, String status, Instant enrolledAt, Long batchId, String batchName, String batchCode) {
        this(id, courseId, courseName, courseThumbnail, status, enrolledAt, batchId, batchName, batchCode, "free", 0.0);
    }
}

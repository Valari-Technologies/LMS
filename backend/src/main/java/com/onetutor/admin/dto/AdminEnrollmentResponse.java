package com.onetutor.admin.dto;

import com.onetutor.enrollment.entity.Enrollment;

import java.time.Instant;

public record AdminEnrollmentResponse(
        Long id,
        Long studentId,
        String studentName,
        String studentEmail,
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        String status,
        Instant enrolledAt,
        String pricingType,
        Double amountPaid
) {
    public static AdminEnrollmentResponse from(Enrollment e) {
        return new AdminEnrollmentResponse(
                e.getId(),
                e.getStudent() != null ? e.getStudent().getId() : null,
                e.getStudent() != null ? e.getStudent().getName() : "Unknown Student",
                e.getStudent() != null ? e.getStudent().getEmail() : "",
                e.getCourse() != null ? e.getCourse().getId() : null,
                e.getCourse() != null ? e.getCourse().getName() : "Unknown Course",
                e.getBatch() != null ? e.getBatch().getId() : null,
                e.getBatch() != null ? e.getBatch().getName() : null,
                e.getStatus() != null ? e.getStatus().name() : "active",
                e.getEnrolledAt(),
                e.getPricingType() != null ? e.getPricingType() : "free",
                e.getAmountPaidDouble()
        );
    }
}


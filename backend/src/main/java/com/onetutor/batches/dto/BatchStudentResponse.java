package com.onetutor.batches.dto;

import com.onetutor.enrollment.entity.Enrollment;

import java.time.Instant;

public record BatchStudentResponse(
        Long enrollmentId,
        Long studentId,
        String studentName,
        String studentEmail,
        String profileImage,
        String status,
        Instant enrolledAt,
        Double progressPercent,
        Integer completedContents,
        Integer totalContents
) {
    public static BatchStudentResponse from(Enrollment e, Double progressPercent, Integer completedContents, Integer totalContents) {
        return new BatchStudentResponse(
                e.getId(),
                e.getStudent().getId(),
                e.getStudent().getName(),
                e.getStudent().getEmail(),
                e.getStudent().getProfileImage(),
                e.getStatus() != null ? e.getStatus().name() : "active",
                e.getEnrolledAt(),
                progressPercent != null ? progressPercent : 0.0,
                completedContents != null ? completedContents : 0,
                totalContents != null ? totalContents : 0
        );
    }

    public static BatchStudentResponse from(Enrollment e) {
        return from(e, 0.0, 0, 0);
    }
}

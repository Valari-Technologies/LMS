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
        Integer totalContents,
        Double attendanceRate,
        Integer attendedSessions,
        Integer totalHeldSessions,
        Integer missedSessions
) {
    public static BatchStudentResponse from(Enrollment e, Double progressPercent, Integer completedContents, Integer totalContents,
                                            Double attendanceRate, Integer attendedSessions, Integer totalHeldSessions, Integer missedSessions) {
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
                totalContents != null ? totalContents : 0,
                attendanceRate != null ? attendanceRate : 100.0,
                attendedSessions != null ? attendedSessions : 0,
                totalHeldSessions != null ? totalHeldSessions : 0,
                missedSessions != null ? missedSessions : 0
        );
    }

    public static BatchStudentResponse from(Enrollment e, Double progressPercent, Integer completedContents, Integer totalContents) {
        return from(e, progressPercent, completedContents, totalContents, 100.0, 0, 0, 0);
    }

    public static BatchStudentResponse from(Enrollment e) {
        return from(e, 0.0, 0, 0, 100.0, 0, 0, 0);
    }
}

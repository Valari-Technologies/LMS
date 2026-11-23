package com.onetutor.live.dto;

import java.time.Instant;
import java.util.List;

public record SessionAttendanceSheetResponse(
        Long sessionId,
        String sessionTitle,
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        Instant scheduledAt,
        String sessionStatus,
        int totalEnrolled,
        int presentCount,
        int absentCount,
        double attendancePercentage,
        List<StudentAttendanceItem> students
) {
    public record StudentAttendanceItem(
            Long studentId,
            String studentName,
            String studentEmail,
            String profileImage,
            String status,
            Instant attendedAt,
            Instant joinTime
    ) {}
}

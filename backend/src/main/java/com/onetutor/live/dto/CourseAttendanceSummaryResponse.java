package com.onetutor.live.dto;

import java.time.Instant;
import java.util.List;

public record CourseAttendanceSummaryResponse(
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        int totalSessions,
        int attendedSessions,
        int missedSessions,
        double attendancePercentage,
        List<SessionAttendanceItem> sessions
) {
    public record SessionAttendanceItem(
            Long sessionId,
            String sessionTitle,
            Instant scheduledAt,
            Instant endTime,
            String sessionStatus,
            String attendanceStatus,
            Instant attendedAt
    ) {}
}

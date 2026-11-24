package com.onetutor.admin.dto;

import com.onetutor.audit.dto.AuditLogResponse;

import java.util.List;

public record AdminDashboardStatsResponse(
        long totalStudents,
        long activeStudents,
        long disabledStudents,
        long totalCourses,
        long publishedCourses,
        long draftCourses,
        long archivedCourses,
        long totalEnrollments,
        long activeEnrollments,
        long upcomingLiveSessions,
        long totalDoubtsAsked,
        long totalDoubtsReplied,
        long pendingDoubts,
        List<AuditLogResponse> recentAuditLogs
) {}

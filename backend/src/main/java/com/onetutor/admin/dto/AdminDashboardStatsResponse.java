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
        long todayNewLogins,
        long todayEnrollments,
        List<AuditLogResponse> recentAuditLogs
) {
    /** Overloaded constructor for backwards compatibility with 14-arg caller. */
    public AdminDashboardStatsResponse(
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
    ) {
        this(totalStudents, activeStudents, disabledStudents, totalCourses, publishedCourses,
             draftCourses, archivedCourses, totalEnrollments, activeEnrollments, upcomingLiveSessions,
             totalDoubtsAsked, totalDoubtsReplied, pendingDoubts, 0L, 0L, recentAuditLogs);
    }

    /** Overloaded constructor for backwards compatibility with 11-arg caller. */
    public AdminDashboardStatsResponse(
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
            List<AuditLogResponse> recentAuditLogs
    ) {
        this(totalStudents, activeStudents, disabledStudents, totalCourses, publishedCourses,
             draftCourses, archivedCourses, totalEnrollments, activeEnrollments, upcomingLiveSessions,
             0L, 0L, 0L, 0L, 0L, recentAuditLogs);
    }
}

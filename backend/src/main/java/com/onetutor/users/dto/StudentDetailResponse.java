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
        Instant lastActiveAt,
        int totalEnrollments,
        StudentAnalyticsSummary analytics,
        List<EnrolledCourseSummary> enrolledCourses,
        List<StudentAssessmentSummary> assessments,
        List<StudentAttendanceSummary> attendanceRecords,
        List<StudentActivityItem> recentActivity
) {
    public record StudentAnalyticsSummary(
            int totalCoursesEnrolled,
            int completedCourses,
            int inProgressCourses,
            int totalLessonsCompleted,
            int totalLearningMinutes,
            double overallProgressPercent,
            int totalQuizzesTaken,
            int quizzesPassed,
            double averageQuizScore,
            int liveSessionsAttended,
            int totalLiveSessions
    ) {}

    public record EnrolledCourseSummary(
            Long enrollmentId,
            Long courseId,
            String courseName,
            String categoryName,
            String status,
            Instant enrolledAt,
            double progressPercent,
            int completedContents,
            int totalContents,
            Instant lastAccessedAt,
            List<SectionProgressSummary> sections
    ) {}

    public record SectionProgressSummary(
            Long sectionId,
            String sectionTitle,
            int totalContents,
            int completedContents,
            double progressPercent
    ) {}

    public record StudentAssessmentSummary(
            Long attemptId,
            Long assessmentId,
            String title,
            String courseName,
            Integer score,
            Integer totalMarks,
            Double percentage,
            Double passingPercentage,
            boolean passed,
            String status,
            Instant startedAt,
            Instant completedAt
    ) {}

    public record StudentAttendanceSummary(
            Long attendanceId,
            Long sessionId,
            String sessionTitle,
            String courseName,
            Instant scheduledAt,
            Instant joinedAt,
            String status
    ) {}

    public record StudentActivityItem(
            String type,
            String title,
            String description,
            Instant timestamp,
            String icon
    ) {}
}

package com.onetutor.community.dto;

/**
 * Lightweight summary of a course's community used in the community list.
 */
public record CourseCommunityStats(
        Long courseId,
        String courseName,
        String courseThumbnail,
        long totalMessages,
        long activeEnrollments,
        long unreadCount,
        String lastMessage,
        boolean disabled
) {
    public CourseCommunityStats(Long courseId, String courseName, String courseThumbnail, long totalMessages, long activeEnrollments) {
        this(courseId, courseName, courseThumbnail, totalMessages, activeEnrollments, 0L, null, false);
    }

    public CourseCommunityStats(Long courseId, String courseName, String courseThumbnail, long totalMessages, long activeEnrollments, long unreadCount) {
        this(courseId, courseName, courseThumbnail, totalMessages, activeEnrollments, unreadCount, null, false);
    }

    public CourseCommunityStats(Long courseId, String courseName, String courseThumbnail, long totalMessages, long activeEnrollments, long unreadCount, String lastMessage) {
        this(courseId, courseName, courseThumbnail, totalMessages, activeEnrollments, unreadCount, lastMessage, false);
    }
}

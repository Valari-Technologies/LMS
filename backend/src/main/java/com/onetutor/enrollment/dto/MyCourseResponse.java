package com.onetutor.enrollment.dto;

public record MyCourseResponse(
        Long enrollmentId,
        Long courseId,
        String courseName,
        String courseThumbnail,
        String courseStatus,
        Double progressPercent,
        Long lastAccessedContentId,
        Long batchId,
        String batchName,
        String level,
        String planType
) {
    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, null, null, null, "FULL_ACCESS");
    }

    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId,
                            Long batchId, String batchName, String level) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, batchId, batchName, level, "FULL_ACCESS");
    }
}

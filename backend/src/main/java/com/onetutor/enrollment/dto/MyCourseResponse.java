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
        String planType,
        Integer totalContents
) {
    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, null, null, null, "FULL_ACCESS", null);
    }

    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId,
                            Long batchId, String batchName, String level) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, batchId, batchName, level, "FULL_ACCESS", null);
    }

    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId,
                            Long batchId, String batchName, String level, String planType) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, batchId, batchName, level, planType, null);
    }
}

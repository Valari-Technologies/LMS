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
        String level
) {
    public MyCourseResponse(Long enrollmentId, Long courseId, String courseName, String courseThumbnail,
                            String courseStatus, Double progressPercent, Long lastAccessedContentId) {
        this(enrollmentId, courseId, courseName, courseThumbnail, courseStatus, progressPercent, lastAccessedContentId, null, null, null);
    }
}

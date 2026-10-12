package com.onetutor.admin.dto;

public class CourseEnrollmentStatResponse {

    private Long courseId;
    private String courseName;
    private String categoryName;
    private long totalEnrollments;

    public CourseEnrollmentStatResponse(Long courseId, String courseName, String categoryName, long totalEnrollments) {
        this.courseId = courseId;
        this.courseName = courseName;
        this.categoryName = categoryName;
        this.totalEnrollments = totalEnrollments;
    }

    public Long getCourseId() { return courseId; }
    public String getCourseName() { return courseName; }
    public String getCategoryName() { return categoryName; }
    public long getTotalEnrollments() { return totalEnrollments; }
}

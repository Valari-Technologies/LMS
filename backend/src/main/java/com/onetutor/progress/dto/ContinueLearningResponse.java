package com.onetutor.progress.dto;

public record ContinueLearningResponse(
        Long courseId,
        String courseName,
        Long sectionId,
        String sectionTitle,
        Long contentId,
        String contentTitle,
        double courseProgressPercent
) {}

package com.onetutor.reviews.dto;

import java.util.Map;

public record CourseRatingSummary(
        Long courseId,
        Double averageRating,
        Long totalReviews,
        Map<Integer, Long> distribution
) {}

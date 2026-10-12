package com.onetutor.reviews.dto;

public record AdminReviewStats(
        long totalReviews,
        double overallAverageRating,
        long fiveStarCount,
        long uniqueStudentsCount,
        long reviewedCoursesCount,
        long pendingReviewsCount
) {}

package com.onetutor.courses.dto;

/** Catalog card shape — SRS section 23. Never includes protected content. */
public record CourseCardResponse(
        Long id,
        String name,
        String shortDesc,
        String thumbnail,
        String categoryName,
        String level,
        String duration,
        String language,
        String pricingType,
        Double price,
        String currency,
        String subscriptionPeriod
) {
    public CourseCardResponse(
            Long id, String name, String shortDesc, String thumbnail,
            String categoryName, String level, String duration, String language) {
        this(id, name, shortDesc, thumbnail, categoryName, level, duration, language,
             "free", 0.0, "INR", "lifetime");
    }
}

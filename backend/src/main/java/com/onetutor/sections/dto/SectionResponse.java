package com.onetutor.sections.dto;

import java.time.Instant;

public record SectionResponse(
        Long id,
        Long courseId,
        String title,
        String description,
        int displayOrder,
        String status,
        int contentCount,
        Instant createdAt
) {}

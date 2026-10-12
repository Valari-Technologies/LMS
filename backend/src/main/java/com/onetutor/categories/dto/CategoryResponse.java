package com.onetutor.categories.dto;

import java.time.Instant;

public record CategoryResponse(
        Long id,
        String name,
        String description,
        String status,
        Instant createdAt,
        Instant updatedAt
) {}

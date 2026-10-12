package com.onetutor.contents.dto;

public record ContentResourceRequest(
        Long mediaAssetId,
        String resourceType,
        String title,
        String description,
        Integer displayOrder
) {}

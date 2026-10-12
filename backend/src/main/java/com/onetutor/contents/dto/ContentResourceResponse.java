package com.onetutor.contents.dto;

import com.onetutor.contents.entity.ContentResource;

import java.time.Instant;

public record ContentResourceResponse(
        Long id,
        Long contentId,
        Long mediaAssetId,
        String resourceType,
        String title,
        String description,
        String url,
        int displayOrder,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContentResourceResponse from(ContentResource cr) {
        String resourceUrl = null;
        if (cr.getMediaAsset() != null) {
            resourceUrl = (cr.getMediaAsset().getStoragePath() != null && cr.getMediaAsset().getStoragePath().startsWith("http"))
                    ? cr.getMediaAsset().getStoragePath()
                    : "/api/v1/media/files/" + cr.getMediaAsset().getId();
        } else if ("link".equalsIgnoreCase(cr.getResourceType())) {
            resourceUrl = cr.getDescription();
        }

        return new ContentResourceResponse(
                cr.getId(),
                cr.getContent().getId(),
                cr.getMediaAsset() != null ? cr.getMediaAsset().getId() : null,
                cr.getResourceType(),
                cr.getTitle(),
                cr.getDescription(),
                resourceUrl,
                cr.getDisplayOrder(),
                cr.getCreatedAt(),
                cr.getUpdatedAt()
        );
    }
}

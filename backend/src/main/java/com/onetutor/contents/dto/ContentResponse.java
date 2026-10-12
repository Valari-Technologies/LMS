package com.onetutor.contents.dto;

import java.time.Instant;
import java.util.List;

public record ContentResponse(
        Long id,
        Long sectionId,
        String title,
        String description,
        String contentType,
        String mediaReference,
        int displayOrder,
        String completionRule,
        String status,
        List<ResourceResponse> resources,
        List<ContentResourceResponse> contentResources,
        Instant createdAt,
        String subtitleUrl,
        String subtitleStatus,
        String subtitleLanguage,
        String subtitleSourceLanguage,
        Instant subtitleGeneratedAt,
        String subtitleError,
        int subtitleProgress
) {
    public ContentResponse(Long id, Long sectionId, String title, String description,
                           String contentType, String mediaReference, int displayOrder,
                           String completionRule, String status, List<ResourceResponse> resources) {
        this(id, sectionId, title, description, contentType, mediaReference, displayOrder,
             completionRule, status, resources, List.of(), null, null, null, "en", null, null, null, 0);
    }
}

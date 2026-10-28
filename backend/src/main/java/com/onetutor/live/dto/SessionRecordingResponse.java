package com.onetutor.live.dto;

import com.onetutor.live.entity.SessionRecording;

import java.time.Instant;

public record SessionRecordingResponse(
        Long id,
        Long mediaAssetId,
        String url,
        String recordingUrl,
        Integer duration,
        String subtitleUrl,
        String subtitleStatus,
        String subtitleLanguage,
        Integer subtitleProgress,
        Instant createdAt,
        Instant updatedAt
) {
    public static SessionRecordingResponse from(SessionRecording r) {
        String finalUrl = r.getUrl();
        if (r.getMediaAsset() != null) {
            String assetStorage = r.getMediaAsset().getStoragePath();
            if (assetStorage != null && (assetStorage.startsWith("http://") || assetStorage.startsWith("https://"))) {
                finalUrl = assetStorage;
            } else if (finalUrl == null || finalUrl.isBlank()) {
                finalUrl = "/api/v1/media/files/" + r.getMediaAsset().getId();
            }
        }
        return new SessionRecordingResponse(
                r.getId(),
                r.getMediaAsset() != null ? r.getMediaAsset().getId() : null,
                finalUrl,
                finalUrl,
                r.getDuration(),
                r.getSubtitleUrl(),
                r.getSubtitleStatus() != null ? r.getSubtitleStatus() : "PENDING",
                r.getSubtitleLanguage() != null ? r.getSubtitleLanguage() : "en",
                r.getSubtitleProgress() != null ? r.getSubtitleProgress() : 0,
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}


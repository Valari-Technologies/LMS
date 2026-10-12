package com.onetutor.live.dto;

import com.onetutor.live.entity.SessionRecording;

import java.time.Instant;

public record SessionRecordingResponse(
        Long id,
        Long mediaAssetId,
        String url,
        String recordingUrl,
        Integer duration,
        Instant createdAt,
        Instant updatedAt
) {
    public static SessionRecordingResponse from(SessionRecording r) {
        String finalUrl = r.getUrl();
        if ((finalUrl == null || finalUrl.isBlank()) && r.getMediaAsset() != null) {
            finalUrl = "/api/v1/media/files/" + r.getMediaAsset().getId();
        }
        return new SessionRecordingResponse(
                r.getId(),
                r.getMediaAsset() != null ? r.getMediaAsset().getId() : null,
                finalUrl,
                finalUrl,
                r.getDuration(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}


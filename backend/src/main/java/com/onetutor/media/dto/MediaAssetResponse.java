package com.onetutor.media.dto;

import com.onetutor.media.entity.MediaAsset;

import java.time.Instant;

public record MediaAssetResponse(
        Long id,
        String filename,
        String fileName,
        String originalName,
        String fileType,
        String mimeType,
        long fileSize,
        String storagePath,
        String thumbnailPath,
        String status,
        String url,
        String uploadedBy,
        Instant createdAt,
        Instant updatedAt
) {
    public static MediaAssetResponse from(MediaAsset asset) {
        String url = (asset.getStoragePath() != null && asset.getStoragePath().startsWith("http"))
                ? asset.getStoragePath()
                : "/api/v1/media/files/" + asset.getId();
        String uploadedByEmail = null;
        try {
            if (asset.getUploadedBy() != null) {
                uploadedByEmail = asset.getUploadedBy().getEmail();
            }
        } catch (Exception ignored) {}

        return new MediaAssetResponse(
                asset.getId(),
                asset.getFileName(),
                asset.getFileName(),
                asset.getOriginalName(),
                asset.getFileType(),
                asset.getMimeType(),
                asset.getFileSize(),
                asset.getStoragePath(),
                asset.getThumbnailPath(),
                asset.getStatus(),
                url,
                uploadedByEmail,
                asset.getCreatedAt(),
                asset.getUpdatedAt()
        );
    }
}

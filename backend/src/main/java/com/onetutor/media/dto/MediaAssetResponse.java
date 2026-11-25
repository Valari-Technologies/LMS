package com.onetutor.media.dto;

import com.onetutor.media.entity.MediaAsset;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;

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
        String uploaderRole,
        String uploaderSource,
        String uploaderName,
        Instant createdAt,
        Instant updatedAt
) {
    public static MediaAssetResponse from(MediaAsset asset) {
        String url = (asset.getStoragePath() != null && asset.getStoragePath().startsWith("http"))
                ? asset.getStoragePath()
                : "/api/v1/media/files/" + asset.getId();
        String uploadedByEmail = null;
        String uploaderRole = "super_admin";
        String uploaderSource = "ONETUTOR";
        String uploaderName = "One Tutor";

        try {
            if (asset.getUploadedBy() != null) {
                User u = asset.getUploadedBy();
                uploadedByEmail = u.getEmail();
                if (u.getRole() != null) {
                    uploaderRole = u.getRole().name();
                    if (u.getRole() == UserRole.student) {
                        uploaderSource = "USER";
                        uploaderName = (u.getName() != null && !u.getName().isBlank()) ? u.getName() : "Student";
                    } else {
                        uploaderSource = "ONETUTOR";
                        uploaderName = (u.getName() != null && !u.getName().isBlank() && !u.getName().equalsIgnoreCase("Super Admin"))
                                ? u.getName() : "One Tutor";
                    }
                }
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
                uploaderRole,
                uploaderSource,
                uploaderName,
                asset.getCreatedAt(),
                asset.getUpdatedAt()
        );
    }
}

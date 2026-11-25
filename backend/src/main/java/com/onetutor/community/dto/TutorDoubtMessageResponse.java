package com.onetutor.community.dto;

import com.onetutor.community.entity.TutorDoubtMessage;

import java.time.Instant;

public record TutorDoubtMessageResponse(
        Long id,
        Long courseId,
        Long studentId,
        Long senderId,
        String senderName,
        String senderAvatar,
        String senderRole,
        String content,
        String messageType,
        Long mediaAssetId,
        String mediaUrl,
        String mediaName,
        String mediaMimeType,
        long mediaSize,
        boolean edited,
        boolean deleted,
        boolean deletedByAdmin,
        Instant createdAt,
        Instant updatedAt
) {
    public static TutorDoubtMessageResponse from(TutorDoubtMessage m) {
        String senderName = m.getSender().getName();
        String senderRole = m.getSender().getRole() != null ? m.getSender().getRole().name() : "";
        if (senderName == null || senderName.equalsIgnoreCase("Super Admin")
                || senderName.toLowerCase().contains("super admin")
                || "super_admin".equalsIgnoreCase(senderRole)) {
            senderName = "One Tutor";
        }

        if (m.isDeleted()) {
            return new TutorDoubtMessageResponse(
                    m.getId(),
                    m.getCourse().getId(),
                    m.getStudent().getId(),
                    m.getSender().getId(),
                    senderName,
                    m.getSender().getProfileImage(),
                    senderRole,
                    "This doubt message was deleted",
                    "text",
                    null,
                    null,
                    null,
                    null,
                    0L,
                    false,
                    true,
                    m.isDeletedByAdmin(),
                    m.getCreatedAt(),
                    m.getUpdatedAt()
            );
        }

        String mediaUrl  = null;
        String mediaName = null;
        String mediaMime = null;
        long   mediaSize = 0;
        Long   mediaId   = null;

        if (m.getMediaAsset() != null) {
            var asset = m.getMediaAsset();
            mediaId   = asset.getId();
            mediaUrl  = (asset.getStoragePath() != null && asset.getStoragePath().startsWith("http"))
                    ? asset.getStoragePath()
                    : "/api/v1/media/files/" + asset.getId();
            mediaName = asset.getOriginalName() != null ? asset.getOriginalName() : asset.getFileName();
            mediaMime = asset.getMimeType();
            mediaSize = asset.getFileSize();
        }

        return new TutorDoubtMessageResponse(
                m.getId(),
                m.getCourse().getId(),
                m.getStudent().getId(),
                m.getSender().getId(),
                senderName,
                m.getSender().getProfileImage(),
                senderRole,
                m.getContent(),
                m.getMessageType().name(),
                mediaId,
                mediaUrl,
                mediaName,
                mediaMime,
                mediaSize,
                m.isEdited(),
                false,
                false,
                m.getCreatedAt(),
                m.getUpdatedAt()
        );
    }
}

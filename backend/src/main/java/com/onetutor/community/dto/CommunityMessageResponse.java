package com.onetutor.community.dto;

import com.onetutor.community.entity.CommunityMessage;

import java.time.Instant;

public record CommunityMessageResponse(
        Long id,
        Long courseId,
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
    public static CommunityMessageResponse from(CommunityMessage m) {
        if (m.isDeleted()) {
            return new CommunityMessageResponse(
                    m.getId(),
                    m.getCourse().getId(),
                    m.getSender().getId(),
                    m.getSender().getName(),
                    m.getSender().getProfileImage(),
                    m.getSender().getRole().name(),
                    "This message was deleted",
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

        return new CommunityMessageResponse(
                m.getId(),
                m.getCourse().getId(),
                m.getSender().getId(),
                m.getSender().getName(),
                m.getSender().getProfileImage(),
                m.getSender().getRole().name(),
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

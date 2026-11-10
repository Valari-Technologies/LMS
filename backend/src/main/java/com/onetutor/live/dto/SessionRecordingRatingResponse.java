package com.onetutor.live.dto;

import com.onetutor.live.entity.SessionRecordingRating;
import java.time.Instant;

public record SessionRecordingRatingResponse(
        Long id,
        Long recordingId,
        Long studentId,
        String studentName,
        Integer rating,
        String comment,
        Instant createdAt,
        Instant updatedAt
) {
    public static SessionRecordingRatingResponse from(SessionRecordingRating r) {
        return new SessionRecordingRatingResponse(
                r.getId(),
                r.getRecording().getId(),
                r.getStudent().getId(),
                r.getStudent().getName(),
                r.getRating(),
                r.getComment(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}

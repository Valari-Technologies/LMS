package com.onetutor.live.dto;

import com.onetutor.live.entity.LiveSession;

import java.time.Instant;
import java.util.List;

public record LiveSessionResponse(
        Long id,
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        String batchCode,
        Long sectionId,
        String sectionTitle,
        String title,
        String description,
        Instant scheduledAt,
        Instant endTime,
        String meetingUrl,
        String status,
        List<SessionRecordingResponse> recordings,
        Instant createdAt,
        Boolean enrolled
) {
    public static LiveSessionResponse from(LiveSession s, String joinUrl) {
        return from(s, joinUrl, true);
    }

    public static LiveSessionResponse from(LiveSession s, String joinUrl, Boolean enrolled) {
        String status = s.getStatus().name();

        return new LiveSessionResponse(
                s.getId(),
                s.getCourse().getId(),
                s.getCourse().getName(),
                s.getBatch() != null ? s.getBatch().getId() : null,
                s.getBatch() != null ? s.getBatch().getName() : null,
                s.getBatch() != null ? s.getBatch().getCode() : null,
                s.getSection() != null ? s.getSection().getId() : null,
                s.getSection() != null ? s.getSection().getTitle() : null,
                s.getTitle(),
                s.getDescription(),
                s.getScheduledAt(),
                s.getEndTime(),
                joinUrl != null ? joinUrl : s.getMeetingUrl(),
                status,
                s.getRecordings() != null ? s.getRecordings().stream().map(SessionRecordingResponse::from).toList() : List.of(),
                s.getCreatedAt(),
                enrolled != null ? enrolled : false
        );
    }
}

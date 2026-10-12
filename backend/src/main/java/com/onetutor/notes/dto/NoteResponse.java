package com.onetutor.notes.dto;

import com.onetutor.notes.entity.VideoNote;

import java.time.Instant;

public record NoteResponse(
        Long id,
        Long userId,
        Long contentId,
        Long courseId,
        String lectureTitle,
        String text,
        String audioUrl,
        String imageUrl,
        String fileUrl,
        String fileName,
        String noteType,
        Double videoTimestampSeconds,
        String videoTimestamp,
        Instant createdAt,
        Instant updatedAt
) {
    public static NoteResponse from(VideoNote note) {
        return new NoteResponse(
                note.getId(),
                note.getUser() != null ? note.getUser().getId() : null,
                note.getContent() != null ? note.getContent().getId() : null,
                note.getCourse() != null ? note.getCourse().getId() : null,
                note.getContent() != null ? note.getContent().getTitle() : "Lecture",
                note.getText(),
                note.getAudioUrl(),
                note.getImageUrl(),
                note.getFileUrl(),
                note.getFileName(),
                note.getNoteType() != null ? note.getNoteType() : "text",
                note.getVideoTimestampSeconds(),
                note.getVideoTimestamp(),
                note.getCreatedAt(),
                note.getUpdatedAt()
        );
    }
}

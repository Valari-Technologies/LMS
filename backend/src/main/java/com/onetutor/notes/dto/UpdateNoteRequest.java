package com.onetutor.notes.dto;

public record UpdateNoteRequest(
        String text,
        String audioUrl,
        String imageUrl,
        String fileUrl,
        String fileName,
        String noteType,
        Double videoTimestampSeconds,
        String videoTimestamp
) {}

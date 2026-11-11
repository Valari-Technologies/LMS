package com.onetutor.live.dto;

import com.onetutor.live.entity.LiveSession;
import com.onetutor.live.entity.SessionRecording;
import com.onetutor.live.entity.SessionRecordingRating;
import com.onetutor.users.entity.User;

import java.time.Instant;

public record SessionRecordingRatingResponse(
        Long id,
        Long recordingId,
        String recordingTitle,
        Long sessionId,
        String sessionTitle,
        Long courseId,
        String courseName,
        Long studentId,
        String studentName,
        String studentEmail,
        String studentAvatar,
        Integer rating,
        String comment,
        String status,
        Instant createdAt,
        Instant updatedAt,
        boolean canEdit
) {
    public static SessionRecordingRatingResponse from(SessionRecordingRating r) {
        return from(r, null, false);
    }

    public static SessionRecordingRatingResponse from(SessionRecordingRating r, Long currentUserId, boolean isAdmin) {
        if (r == null) return null;
        User u = r.getStudent();
        SessionRecording rec = r.getRecording();
        LiveSession session = rec != null ? rec.getSession() : null;
        var course = session != null ? session.getCourse() : null;

        boolean canEdit = currentUserId != null && u != null && currentUserId.equals(u.getId());
        boolean isOwner = canEdit;

        String commentText = r.getComment();
        if ("pending".equalsIgnoreCase(r.getStatus()) && !isOwner && !isAdmin) {
            commentText = null;
        }

        return new SessionRecordingRatingResponse(
                r.getId(),
                rec != null ? rec.getId() : null,
                rec != null && rec.getTitle() != null ? rec.getTitle() : ("Recording #" + (rec != null ? rec.getId() : "")),
                session != null ? session.getId() : null,
                session != null ? session.getTitle() : null,
                course != null ? course.getId() : null,
                course != null ? course.getName() : null,
                u != null ? u.getId() : null,
                u != null ? u.getName() : "Student",
                u != null ? u.getEmail() : null,
                u != null ? u.getAvatar() : null,
                r.getRating(),
                commentText,
                r.getStatus() != null ? r.getStatus() : "pending",
                r.getCreatedAt(),
                r.getUpdatedAt(),
                canEdit
        );
    }
}

package com.onetutor.notes.service;

import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.courses.entity.Course;
import com.onetutor.notes.dto.CreateNoteRequest;
import com.onetutor.notes.dto.NoteResponse;
import com.onetutor.notes.dto.UpdateNoteRequest;
import com.onetutor.notes.entity.VideoNote;
import com.onetutor.notes.repository.VideoNoteRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class VideoNoteService {

    private final VideoNoteRepository noteRepo;
    private final ContentRepository contentRepo;

    public VideoNoteService(VideoNoteRepository noteRepo, ContentRepository contentRepo) {
        this.noteRepo = noteRepo;
        this.contentRepo = contentRepo;
    }

    public NoteResponse createNote(Long contentId, CreateNoteRequest req, User user) {
        Content content = contentRepo.findById(contentId)
                .orElseThrow(() -> new NotFoundException("NOT_FOUND", "Content not found with id: " + contentId));

        Course course = content.getSection() != null ? content.getSection().getCourse() : null;
        if (course == null) {
            throw new NotFoundException("NOT_FOUND", "Course not found for content id: " + contentId);
        }

        String trimmedText = req.text() != null ? req.text().trim() : null;
        String audioUrl = req.audioUrl() != null && !req.audioUrl().isBlank() ? req.audioUrl().trim() : null;
        String imageUrl = req.imageUrl() != null && !req.imageUrl().isBlank() ? req.imageUrl().trim() : null;
        String fileUrl = req.fileUrl() != null && !req.fileUrl().isBlank() ? req.fileUrl().trim() : null;
        String fileName = req.fileName() != null && !req.fileName().isBlank() ? req.fileName().trim() : null;

        if ((trimmedText == null || trimmedText.isBlank()) && audioUrl == null && imageUrl == null && fileUrl == null) {
            throw new IllegalArgumentException("Note must contain text, voice recording, photo/image, or attached document");
        }

        String noteType = req.noteType();
        if (noteType == null || noteType.isBlank()) {
            int count = 0;
            if (trimmedText != null && !trimmedText.isBlank()) count++;
            if (audioUrl != null) count++;
            if (imageUrl != null) count++;
            if (fileUrl != null) count++;

            if (count > 1) {
                noteType = "mixed";
            } else if (imageUrl != null) {
                noteType = "image";
            } else if (fileUrl != null) {
                noteType = "file";
            } else if (audioUrl != null) {
                noteType = "voice";
            } else {
                noteType = "text";
            }
        }

        VideoNote note = new VideoNote(
                user,
                content,
                course,
                trimmedText,
                req.videoTimestampSeconds(),
                req.videoTimestamp()
        );
        note.setAudioUrl(audioUrl);
        note.setImageUrl(imageUrl);
        note.setFileUrl(fileUrl);
        note.setFileName(fileName);
        note.setNoteType(noteType);

        VideoNote saved = noteRepo.save(note);
        return NoteResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotesByContent(Long contentId, User user) {
        return noteRepo.findByUserIdAndContentId(user.getId(), contentId)
                .stream()
                .map(NoteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotesByCourse(Long courseId, User user) {
        return noteRepo.findByUserIdAndCourseId(user.getId(), courseId)
                .stream()
                .map(NoteResponse::from)
                .toList();
    }

    public NoteResponse updateNote(Long noteId, UpdateNoteRequest req, User user) {
        VideoNote note = noteRepo.findById(noteId)
                .orElseThrow(() -> new NotFoundException("NOT_FOUND", "Note not found with id: " + noteId));

        boolean isOwner = note.getUser().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == UserRole.admin || user.getRole() == UserRole.super_admin;
        if (!isOwner && !isAdmin) {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to edit this note");
        }

        if (req.text() != null) {
            note.setText(req.text().trim());
        }
        if (req.audioUrl() != null) {
            note.setAudioUrl(req.audioUrl().trim().isEmpty() ? null : req.audioUrl().trim());
        }
        if (req.imageUrl() != null) {
            note.setImageUrl(req.imageUrl().trim().isEmpty() ? null : req.imageUrl().trim());
        }
        if (req.fileUrl() != null) {
            note.setFileUrl(req.fileUrl().trim().isEmpty() ? null : req.fileUrl().trim());
        }
        if (req.fileName() != null) {
            note.setFileName(req.fileName().trim().isEmpty() ? null : req.fileName().trim());
        }

        if (req.noteType() != null && !req.noteType().isBlank()) {
            note.setNoteType(req.noteType());
        } else {
            int count = 0;
            if (note.getText() != null && !note.getText().isBlank()) count++;
            if (note.getAudioUrl() != null && !note.getAudioUrl().isBlank()) count++;
            if (note.getImageUrl() != null && !note.getImageUrl().isBlank()) count++;
            if (note.getFileUrl() != null && !note.getFileUrl().isBlank()) count++;

            if (count > 1) note.setNoteType("mixed");
            else if (note.getImageUrl() != null) note.setNoteType("image");
            else if (note.getFileUrl() != null) note.setNoteType("file");
            else if (note.getAudioUrl() != null) note.setNoteType("voice");
            else note.setNoteType("text");
        }

        if (req.videoTimestampSeconds() != null) {
            note.setVideoTimestampSeconds(req.videoTimestampSeconds());
        }
        if (req.videoTimestamp() != null && !req.videoTimestamp().isBlank()) {
            note.setVideoTimestamp(req.videoTimestamp());
        }

        VideoNote updated = noteRepo.save(note);
        return NoteResponse.from(updated);
    }

    public void deleteNote(Long noteId, User user) {
        VideoNote note = noteRepo.findById(noteId)
                .orElseThrow(() -> new NotFoundException("NOT_FOUND", "Note not found with id: " + noteId));

        boolean isOwner = note.getUser().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == UserRole.admin || user.getRole() == UserRole.super_admin;
        if (!isOwner && !isAdmin) {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to delete this note");
        }

        noteRepo.delete(note);
    }
}

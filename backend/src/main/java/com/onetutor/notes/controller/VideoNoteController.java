package com.onetutor.notes.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.notes.dto.CreateNoteRequest;
import com.onetutor.notes.dto.NoteResponse;
import com.onetutor.notes.dto.UpdateNoteRequest;
import com.onetutor.notes.service.VideoNoteService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("isAuthenticated()")
public class VideoNoteController {

    private final VideoNoteService noteService;

    public VideoNoteController(VideoNoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping("/contents/{contentId}/notes")
    public ApiResponse<List<NoteResponse>> getNotesForContent(@PathVariable Long contentId,
                                                             @AuthenticationPrincipal User user) {
        return ApiResponse.ok(noteService.getNotesByContent(contentId, user));
    }

    @GetMapping("/courses/{courseId}/notes")
    public ApiResponse<List<NoteResponse>> getNotesForCourse(@PathVariable Long courseId,
                                                           @AuthenticationPrincipal User user) {
        return ApiResponse.ok(noteService.getNotesByCourse(courseId, user));
    }

    @PostMapping("/contents/{contentId}/notes")
    public ApiResponse<NoteResponse> createNote(@PathVariable Long contentId,
                                                @Valid @RequestBody CreateNoteRequest req,
                                                @AuthenticationPrincipal User user) {
        return ApiResponse.ok("Note saved successfully", noteService.createNote(contentId, req, user));
    }

    @PutMapping("/notes/{noteId}")
    public ApiResponse<NoteResponse> updateNote(@PathVariable Long noteId,
                                                @Valid @RequestBody UpdateNoteRequest req,
                                                @AuthenticationPrincipal User user) {
        return ApiResponse.ok("Note updated successfully", noteService.updateNote(noteId, req, user));
    }

    @DeleteMapping("/notes/{noteId}")
    public ApiResponse<Void> deleteNote(@PathVariable Long noteId,
                                        @AuthenticationPrincipal User user) {
        noteService.deleteNote(noteId, user);
        return ApiResponse.ok("Note deleted successfully", null);
    }
}

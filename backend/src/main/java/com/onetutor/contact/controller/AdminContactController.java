package com.onetutor.contact.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.contact.dto.ContactMessageResponse;
import com.onetutor.contact.dto.ContactReplyRequest;
import com.onetutor.contact.dto.ContactStatsResponse;
import com.onetutor.contact.service.ContactService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/contact-messages")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
public class AdminContactController {

    private final ContactService contactService;

    public AdminContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public ApiResponse<PageResponse<ContactMessageResponse>> listMessages(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ApiResponse.ok(contactService.searchAdminMessages(status, search, pageRequest));
    }

    @GetMapping("/stats")
    public ApiResponse<ContactStatsResponse> getStats() {
        return ApiResponse.ok(contactService.getStats());
    }

    @GetMapping("/{id}")
    public ApiResponse<ContactMessageResponse> getMessage(@PathVariable Long id) {
        return ApiResponse.ok(contactService.getMessageById(id));
    }

    @PostMapping("/{id}/reply")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<ContactMessageResponse> replyToMessage(
            @PathVariable Long id,
            @Valid @RequestBody ContactReplyRequest replyReq,
            @AuthenticationPrincipal User admin
    ) {
        ContactMessageResponse response = contactService.replyToMessage(id, replyReq, admin);
        return ApiResponse.ok("Reply sent successfully and dispatched to user's email", response);
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<ContactMessageResponse> toggleArchive(@PathVariable Long id) {
        ContactMessageResponse response = contactService.archiveMessage(id);
        return ApiResponse.ok("Inquiry status updated successfully", response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Void> deleteMessage(@PathVariable Long id) {
        contactService.deleteMessage(id);
        return ApiResponse.ok("Inquiry deleted successfully", null);
    }
}

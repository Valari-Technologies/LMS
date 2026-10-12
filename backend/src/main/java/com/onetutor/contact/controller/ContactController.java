package com.onetutor.contact.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.contact.dto.ContactMessageRequest;
import com.onetutor.contact.dto.ContactMessageResponse;
import com.onetutor.contact.service.ContactService;
import com.onetutor.users.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/contact")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @PostMapping
    public ApiResponse<ContactMessageResponse> submitMessage(
            @Valid @RequestBody ContactMessageRequest req,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request
    ) {
        ContactMessageResponse response = contactService.submitMessage(req, currentUser, request);
        return ApiResponse.ok("Your inquiry has been submitted successfully. Our support team will reply shortly.", response);
    }

    @GetMapping("/my")
    public ApiResponse<List<ContactMessageResponse>> getMyMessages(
            @AuthenticationPrincipal User currentUser
    ) {
        return ApiResponse.ok(contactService.getMyMessages(currentUser));
    }
}

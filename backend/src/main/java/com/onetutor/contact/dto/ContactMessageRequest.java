package com.onetutor.contact.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactMessageRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name cannot exceed 255 characters")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Please provide a valid email address")
        @Size(max = 255, message = "Email cannot exceed 255 characters")
        String email,

        @NotBlank(message = "Topic/Subject is required")
        @Size(max = 255, message = "Subject cannot exceed 255 characters")
        String subject,

        @NotBlank(message = "Message is required")
        @Size(max = 10000, message = "Message cannot exceed 10000 characters")
        String message
) {}

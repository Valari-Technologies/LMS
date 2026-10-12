package com.onetutor.contact.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactReplyRequest(
        @NotBlank(message = "Reply message cannot be empty")
        @Size(max = 10000, message = "Reply message cannot exceed 10000 characters")
        String replyMessage
) {}

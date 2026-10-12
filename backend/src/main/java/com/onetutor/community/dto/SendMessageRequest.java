package com.onetutor.community.dto;

import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @Size(max = 5000, message = "Message content cannot exceed 5000 characters")
        String content,

        String messageType,   // text | image | pdf | video | file

        Long mediaAssetId     // required when messageType != text
) {}

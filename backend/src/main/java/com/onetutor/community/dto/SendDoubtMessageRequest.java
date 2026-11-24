package com.onetutor.community.dto;

import jakarta.validation.constraints.Size;

public record SendDoubtMessageRequest(
        @Size(max = 5000, message = "Doubt message content cannot exceed 5000 characters")
        String content,

        String messageType,   // text | image | pdf | video | file

        Long mediaAssetId     // optional media attachment
) {}

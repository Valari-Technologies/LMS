package com.onetutor.contents.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ContentRequest(
        @NotBlank(message = "Content title is required")
        String title,
        String description,

        @NotNull(message = "Content type is required")
        String contentType,   // VIDEO | PDF | IMAGE | DOWNLOAD | EXTERNAL_LINK

        /** StorageService path for uploaded media, or the raw URL for EXTERNAL_LINK. */
        String mediaReference,

        String completionRule
) {}

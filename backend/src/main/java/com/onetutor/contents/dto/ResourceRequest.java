package com.onetutor.contents.dto;

import jakarta.validation.constraints.NotBlank;

public record ResourceRequest(
        @NotBlank String type,
        @NotBlank String name,
        @NotBlank String url
) {}

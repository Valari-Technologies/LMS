package com.onetutor.sections.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SectionRequest(
        @NotBlank(message = "Section title is required")
        @Size(max = 200)
        String title,
        String description
) {}

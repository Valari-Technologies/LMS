package com.onetutor.categories.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @NotBlank(message = "Category name is required")
        @Size(max = 100)
        String name,

        @Size(max = 2000)
        String description
) {}

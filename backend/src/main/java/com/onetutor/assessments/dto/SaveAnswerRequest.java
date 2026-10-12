package com.onetutor.assessments.dto;

import jakarta.validation.constraints.NotNull;

public record SaveAnswerRequest(
        @NotNull Long questionId,
        String selectedOption // 'A', 'B', 'C', 'D' or null/blank to clear
) {}

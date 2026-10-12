package com.onetutor.assessments.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AssessmentQuestionAdminDto(
        Long id,
        @NotBlank(message = "Question text is required")
        String questionText,
        @NotBlank(message = "Option A is required")
        String optionA,
        @NotBlank(message = "Option B is required")
        String optionB,
        @NotBlank(message = "Option C is required")
        String optionC,
        @NotBlank(message = "Option D is required")
        String optionD,
        @NotBlank(message = "Correct answer is required")
        @Pattern(regexp = "^[A-Da-d]$", message = "Correct answer must be A, B, C, or D")
        String correctAnswer,
        int displayOrder
) {}

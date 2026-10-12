package com.onetutor.assessments.dto;

public record QuestionStudentDto(
        Long id,
        String questionText,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        int displayOrder
) {}

package com.onetutor.batches.dto;

import com.onetutor.batches.entity.BatchStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateBatchRequest(
        @NotNull(message = "Course ID is required")
        Long courseId,

        @NotBlank(message = "Batch name is required")
        @Size(max = 150, message = "Batch name cannot exceed 150 characters")
        String name,

        @NotBlank(message = "Batch code is required")
        @Size(max = 50, message = "Batch code cannot exceed 50 characters")
        String code,

        @NotNull(message = "Capacity is required")
        @Min(value = 1, message = "Capacity must be at least 1")
        Integer capacity,

        BatchStatus status,

        LocalDate startDate,

        LocalDate endDate
) {}

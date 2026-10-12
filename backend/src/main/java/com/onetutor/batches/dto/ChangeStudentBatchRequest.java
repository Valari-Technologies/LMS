package com.onetutor.batches.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeStudentBatchRequest(
        @NotNull(message = "Target batch ID is required")
        Long targetBatchId
) {}

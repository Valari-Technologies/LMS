package com.onetutor.live.dto;

import jakarta.validation.constraints.NotNull;

public record MarkAttendanceRequest(
        @NotNull Long studentId,
        String status
) {}

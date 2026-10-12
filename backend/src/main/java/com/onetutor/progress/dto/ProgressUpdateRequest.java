package com.onetutor.progress.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProgressUpdateRequest(
        @NotNull @Min(0) Integer videoPosition,
        @DecimalMin("0") @DecimalMax("100") BigDecimal progressPercent,
        Integer maxWatchedPosition,
        Integer videoDuration,
        Double playbackRate,
        String playbackSessionId
) {}

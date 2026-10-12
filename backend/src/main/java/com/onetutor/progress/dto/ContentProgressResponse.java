package com.onetutor.progress.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record ContentProgressResponse(
        Long contentId,
        BigDecimal progressPercent,
        int videoPosition,
        int maxWatchedPosition,
        String playbackSessionId,
        boolean completed,
        Instant completedAt,
        Instant lastAccessedAt
) {
    public ContentProgressResponse(Long contentId, BigDecimal progressPercent, int videoPosition, boolean completed, Instant completedAt, Instant lastAccessedAt) {
        this(contentId, progressPercent, videoPosition, videoPosition, null, completed, completedAt, lastAccessedAt);
    }
}

package com.onetutor.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Standard error envelope, per SRS section 42. Never carries stack
 * traces, SQL errors, or internal implementation details.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        boolean success,
        String code,
        String message,
        Map<String, Object> details,
        Instant timestamp,
        String requestId
) {
    public static ApiError of(String code, String message, Map<String, Object> details) {
        return new ApiError(false, code, message, details, Instant.now(), UUID.randomUUID().toString());
    }

    public static ApiError of(String code, String message) {
        return of(code, message, null);
    }
}

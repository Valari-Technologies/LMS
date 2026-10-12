package com.onetutor.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

/**
 * Standard success envelope for every API response, per SRS section 42.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        String message,
        T data,
        Instant timestamp,
        String requestId
) {
    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, Instant.now(), UUID.randomUUID().toString());
    }

    public static <T> ApiResponse<T> ok(T data) {
        return ok("OK", data);
    }
}

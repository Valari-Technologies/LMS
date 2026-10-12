package com.onetutor.audit.dto;

import java.time.Instant;

public record AuditLogResponse(
        Long id,
        Long userId,
        String userName,
        String action,
        String entityType,
        Long entityId,
        String details,
        Instant createdAt
) {}

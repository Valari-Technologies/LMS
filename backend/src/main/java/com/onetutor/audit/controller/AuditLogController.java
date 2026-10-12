package com.onetutor.audit.controller;

import com.onetutor.audit.dto.AuditLogResponse;
import com.onetutor.audit.entity.AuditLog;
import com.onetutor.audit.repository.AuditLogRepository;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only by design (SRS section 39: audit records are not editable
 * through normal admin operations). Access restricted to ROLE_ADMIN via
 * the /api/v1/admin/** URL pattern in SecurityConfig.
 */
@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@Transactional(readOnly = true)
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    public AuditLogController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String entityType) {

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = (entityType == null || entityType.isBlank())
                ? auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)
                : auditLogRepository.findByEntityTypeOrderByCreatedAtDesc(entityType, pageable);

        var mapped = result.map(this::toResponse);
        return ApiResponse.ok(PageResponse.from(mapped));
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getUser() != null ? log.getUser().getId() : null,
                log.getUser() != null ? log.getUser().getName() : "System",
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}

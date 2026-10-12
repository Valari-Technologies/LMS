package com.onetutor.audit.service;

import com.onetutor.audit.entity.AuditLog;
import com.onetutor.audit.repository.AuditLogRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;

/**
 * Called explicitly from admin-mutating service methods (SRS section 39).
 * Deliberately not a generic AOP interceptor around every admin endpoint —
 * that produces mechanical, low-signal entries ("called updateCourse").
 * Callers pass a human-meaningful action name and details instead.
 */
@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(User actor, String action, String entityType, Long entityId, String details) {
        AuditLog entry = new AuditLog();
        entry.setUser(actor);
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setDetails(details);
        auditLogRepository.save(entry);
    }
}

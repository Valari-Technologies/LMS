package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.AssessmentAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AssessmentAuditLogRepository extends JpaRepository<AssessmentAuditLog, Long> {
    List<AssessmentAuditLog> findByAssessmentIdOrderByTimestampDesc(Long assessmentId);
    List<AssessmentAuditLog> findByStudentIdOrderByTimestampDesc(Long studentId);
}

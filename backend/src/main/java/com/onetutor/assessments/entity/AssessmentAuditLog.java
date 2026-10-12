package com.onetutor.assessments.entity;

import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "assessment_audit_logs")
public class AssessmentAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id")
    private AssessmentAttempt attempt;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50)
    private AssessmentEventType eventType;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @PrePersist
    void onCreate() {
        if (timestamp == null) timestamp = Instant.now();
    }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Assessment getAssessment() { return assessment; }
    public void setAssessment(Assessment assessment) { this.assessment = assessment; }
    public AssessmentAttempt getAttempt() { return attempt; }
    public void setAttempt(AssessmentAttempt attempt) { this.attempt = attempt; }
    public AssessmentEventType getEventType() { return eventType; }
    public void setEventType(AssessmentEventType eventType) { this.eventType = eventType; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}

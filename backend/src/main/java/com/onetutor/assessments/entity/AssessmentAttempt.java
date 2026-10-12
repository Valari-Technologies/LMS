package com.onetutor.assessments.entity;

import com.onetutor.contents.entity.Content;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "assessment_attempts")
public class AssessmentAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", nullable = false)
    private Content content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AssessmentStatus status = AssessmentStatus.IN_PROGRESS;

    @Column(name = "total_questions", nullable = false)
    private int totalQuestions = 0;

    @Column(name = "correct_answers", nullable = false)
    private int correctAnswers = 0;

    @Column(name = "obtained_marks", nullable = false)
    private int obtainedMarks = 0;

    @Column(nullable = false)
    private double percentage = 0.0;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber = 1;

    @Column(name = "terminated_reason", length = 50)
    private String terminatedReason;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Column(name = "session_token", length = 100)
    private String sessionToken;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssessmentAttemptAnswer> answers = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (startedAt == null) startedAt = Instant.now();
        lastActivityAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Content getContent() { return content; }
    public void setContent(Content content) { this.content = content; }
    public Assessment getAssessment() { return assessment; }
    public void setAssessment(Assessment assessment) { this.assessment = assessment; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public AssessmentStatus getStatus() { return status; }
    public void setStatus(AssessmentStatus status) { this.status = status; }
    public int getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }
    public int getCorrectAnswers() { return correctAnswers; }
    public void setCorrectAnswers(int correctAnswers) { this.correctAnswers = correctAnswers; }
    public int getObtainedMarks() { return obtainedMarks; }
    public void setObtainedMarks(int obtainedMarks) { this.obtainedMarks = obtainedMarks; }
    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }
    public int getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }
    public String getTerminatedReason() { return terminatedReason; }
    public void setTerminatedReason(String terminatedReason) { this.terminatedReason = terminatedReason; }
    public Instant getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(Instant lastActivityAt) { this.lastActivityAt = lastActivityAt; }
    public String getSessionToken() { return sessionToken; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }
    public List<AssessmentAttemptAnswer> getAnswers() { return answers; }
    public void setAnswers(List<AssessmentAttemptAnswer> answers) { this.answers = answers; }
}

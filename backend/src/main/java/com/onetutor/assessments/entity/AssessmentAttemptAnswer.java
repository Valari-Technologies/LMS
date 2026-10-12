package com.onetutor.assessments.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "assessment_attempt_answers", uniqueConstraints = {
        @UniqueConstraint(name = "uq_attempt_question", columnNames = {"attempt_id", "question_id"})
})
public class AssessmentAttemptAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private AssessmentAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private AssessmentQuestion question;

    @Column(name = "selected_option", length = 10)
    private String selectedOption; // 'A', 'B', 'C', 'D'

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "answered_at")
    private Instant answeredAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        answeredAt = Instant.now();
    }

    public Long getId() { return id; }
    public AssessmentAttempt getAttempt() { return attempt; }
    public void setAttempt(AssessmentAttempt attempt) { this.attempt = attempt; }
    public AssessmentQuestion getQuestion() { return question; }
    public void setQuestion(AssessmentQuestion question) { this.question = question; }
    public String getSelectedOption() { return selectedOption; }
    public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }
    public Boolean getIsCorrect() { return isCorrect; }
    public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }
    public Instant getAnsweredAt() { return answeredAt; }
    public void setAnsweredAt(Instant answeredAt) { this.answeredAt = answeredAt; }
}

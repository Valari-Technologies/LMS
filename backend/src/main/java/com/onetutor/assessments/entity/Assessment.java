package com.onetutor.assessments.entity;

import com.onetutor.contents.entity.Content;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "assessments")
public class Assessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", nullable = false, unique = true)
    private Content content;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(nullable = false)
    private boolean required = false;

    @Column(name = "pass_percentage", nullable = false)
    private int passPercentage = 60;

    @Enumerated(EnumType.STRING)
    @Column(name = "completion_mode", nullable = false, length = 30)
    private CompletionMode completionMode = CompletionMode.PASS_ASSESSMENT;

    @Column(name = "timer_enabled", nullable = false)
    private boolean timerEnabled = false;

    @Column(name = "timer_duration_minutes", nullable = false)
    private int timerDurationMinutes = 10;

    @Column(name = "randomize_questions", nullable = false)
    private boolean randomizeQuestions = false;

    @Column(name = "randomize_options", nullable = false)
    private boolean randomizeOptions = false;

    @OneToMany(mappedBy = "assessment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<AssessmentQuestion> questions = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Content getContent() { return content; }
    public void setContent(Content content) { this.content = content; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public int getPassPercentage() { return passPercentage; }
    public void setPassPercentage(int passPercentage) { this.passPercentage = passPercentage; }
    public CompletionMode getCompletionMode() { return completionMode; }
    public void setCompletionMode(CompletionMode completionMode) { this.completionMode = completionMode; }
    public boolean isTimerEnabled() { return timerEnabled; }
    public void setTimerEnabled(boolean timerEnabled) { this.timerEnabled = timerEnabled; }
    public int getTimerDurationMinutes() { return timerDurationMinutes; }
    public void setTimerDurationMinutes(int timerDurationMinutes) { this.timerDurationMinutes = timerDurationMinutes; }
    public boolean isRandomizeQuestions() { return randomizeQuestions; }
    public void setRandomizeQuestions(boolean randomizeQuestions) { this.randomizeQuestions = randomizeQuestions; }
    public boolean isRandomizeOptions() { return randomizeOptions; }
    public void setRandomizeOptions(boolean randomizeOptions) { this.randomizeOptions = randomizeOptions; }
    public List<AssessmentQuestion> getQuestions() { return questions; }
    public void setQuestions(List<AssessmentQuestion> questions) { this.questions = questions; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

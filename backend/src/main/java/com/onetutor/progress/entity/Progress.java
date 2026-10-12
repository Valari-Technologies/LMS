package com.onetutor.progress.entity;

import com.onetutor.contents.entity.Content;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "progress")
public class Progress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", nullable = false)
    private Content content;

    @Column(name = "progress_percent", nullable = false)
    private Integer progressPercent = 0;

    @Column(name = "video_position", nullable = false)
    private int videoPosition = 0;

    @Column(name = "max_watched_position", nullable = false)
    private int maxWatchedPosition = 0;

    @Column(name = "watched_seconds", nullable = false)
    private int watchedSeconds = 0;

    @Column(name = "last_progress_at")
    private Instant lastProgressAt;

    @Column(name = "playback_session_id", length = 100)
    private String playbackSessionId;

    @Column(nullable = false)
    private boolean completed = false;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "last_accessed_at", nullable = false)
    private Instant lastAccessedAt;

    @PrePersist
    void onCreate() { lastAccessedAt = Instant.now(); }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Content getContent() { return content; }
    public void setContent(Content content) { this.content = content; }
    public BigDecimal getProgressPercent() {
        return progressPercent != null ? BigDecimal.valueOf(progressPercent) : BigDecimal.ZERO;
    }
    public void setProgressPercent(BigDecimal progressPercent) {
        this.progressPercent = progressPercent != null ? progressPercent.intValue() : 0;
    }
    public Integer getProgressPercentInt() { return progressPercent; }
    public void setProgressPercent(Integer progressPercent) {
        this.progressPercent = progressPercent != null ? progressPercent : 0;
    }
    public int getVideoPosition() { return videoPosition; }
    public void setVideoPosition(int videoPosition) { this.videoPosition = videoPosition; }
    public int getMaxWatchedPosition() { return maxWatchedPosition; }
    public void setMaxWatchedPosition(int maxWatchedPosition) { this.maxWatchedPosition = maxWatchedPosition; }
    public int getWatchedSeconds() { return watchedSeconds; }
    public void setWatchedSeconds(int watchedSeconds) { this.watchedSeconds = watchedSeconds; }
    public Instant getLastProgressAt() { return lastProgressAt; }
    public void setLastProgressAt(Instant lastProgressAt) { this.lastProgressAt = lastProgressAt; }
    public String getPlaybackSessionId() { return playbackSessionId; }
    public void setPlaybackSessionId(String playbackSessionId) { this.playbackSessionId = playbackSessionId; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Instant getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(Instant lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
}

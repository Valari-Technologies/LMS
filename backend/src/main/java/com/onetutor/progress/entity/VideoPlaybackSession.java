package com.onetutor.progress.entity;

import com.onetutor.contents.entity.Content;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "video_playback_sessions")
public class VideoPlaybackSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true, length = 100)
    private String sessionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", nullable = false)
    private Content content;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "last_heartbeat_at", nullable = false)
    private Instant lastHeartbeatAt;

    @Column(name = "last_accepted_position", nullable = false)
    private int lastAcceptedPosition = 0;

    @Column(name = "max_watched_position", nullable = false)
    private int maxWatchedPosition = 0;

    @Column(name = "playback_rate", nullable = false)
    private double playbackRate = 1.0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (startedAt == null) startedAt = now;
        if (lastHeartbeatAt == null) lastHeartbeatAt = now;
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Content getContent() { return content; }
    public void setContent(Content content) { this.content = content; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getLastHeartbeatAt() { return lastHeartbeatAt; }
    public void setLastHeartbeatAt(Instant lastHeartbeatAt) { this.lastHeartbeatAt = lastHeartbeatAt; }
    public int getLastAcceptedPosition() { return lastAcceptedPosition; }
    public void setLastAcceptedPosition(int lastAcceptedPosition) { this.lastAcceptedPosition = lastAcceptedPosition; }
    public int getMaxWatchedPosition() { return maxWatchedPosition; }
    public void setMaxWatchedPosition(int maxWatchedPosition) { this.maxWatchedPosition = maxWatchedPosition; }
    public double getPlaybackRate() { return playbackRate; }
    public void setPlaybackRate(double playbackRate) { this.playbackRate = playbackRate; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

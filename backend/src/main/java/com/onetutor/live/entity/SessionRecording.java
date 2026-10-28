package com.onetutor.live.entity;

import com.onetutor.media.entity.MediaAsset;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "session_recordings")
public class SessionRecording {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private LiveSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_asset_id")
    private MediaAsset mediaAsset;

    @Column(nullable = false, length = 500)
    private String url;

    private Integer duration;

    @Column(name = "subtitle_url", length = 1000)
    private String subtitleUrl;

    @Column(name = "subtitle_status", length = 30)
    private String subtitleStatus = "PENDING";

    @Column(name = "subtitle_language", length = 20)
    private String subtitleLanguage = "en";

    @Column(name = "subtitle_progress")
    private Integer subtitleProgress = 0;

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
    public LiveSession getSession() { return session; }
    public void setSession(LiveSession session) { this.session = session; }
    public MediaAsset getMediaAsset() { return mediaAsset; }
    public void setMediaAsset(MediaAsset mediaAsset) { this.mediaAsset = mediaAsset; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
    public String getSubtitleUrl() { return subtitleUrl; }
    public void setSubtitleUrl(String subtitleUrl) { this.subtitleUrl = subtitleUrl; }
    public String getSubtitleStatus() { return subtitleStatus; }
    public void setSubtitleStatus(String subtitleStatus) { this.subtitleStatus = subtitleStatus; }
    public String getSubtitleLanguage() { return subtitleLanguage; }
    public void setSubtitleLanguage(String subtitleLanguage) { this.subtitleLanguage = subtitleLanguage; }
    public Integer getSubtitleProgress() { return subtitleProgress; }
    public void setSubtitleProgress(Integer subtitleProgress) { this.subtitleProgress = subtitleProgress; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

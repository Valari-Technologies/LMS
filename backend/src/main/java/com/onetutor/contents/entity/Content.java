package com.onetutor.contents.entity;

import com.onetutor.subtitles.entity.SubtitleStatus;
import com.onetutor.sections.entity.Section;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "contents")
public class Content {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id", nullable = false)
    private Section section;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 30)
    private ContentType contentType;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;

    @Column(name = "completion_rule", nullable = false, length = 50)
    private String completionRule = "DEFAULT";

    /** Storage-layer reference for VIDEO/PDF/IMAGE, or the raw URL for EXTERNAL_LINK. */
    @Column(name = "media_reference", length = 1000)
    private String mediaReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentStatus status = ContentStatus.active;

    @Column(name = "subtitle_url", length = 1000)
    private String subtitleUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "subtitle_status", length = 30)
    private SubtitleStatus subtitleStatus = SubtitleStatus.PENDING;

    @Column(name = "subtitle_language", length = 10)
    private String subtitleLanguage = "en";

    /** Detected source language of the video audio (e.g., "ta" for Tamil, "hi" for Hindi). */
    @Column(name = "subtitle_source_language", length = 10)
    private String subtitleSourceLanguage;

    @Column(name = "subtitle_generated_at")
    private Instant subtitleGeneratedAt;

    @Column(name = "subtitle_error", columnDefinition = "TEXT")
    private String subtitleError;

    /** Progress percentage (0-100) during subtitle generation. 0=not started, 100=complete. */
    @Column(name = "subtitle_progress")
    private int subtitleProgress = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public Section getSection() { return section; }
    public void setSection(Section section) { this.section = section; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ContentType getContentType() { return contentType; }
    public void setContentType(ContentType contentType) { this.contentType = contentType; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
    public String getCompletionRule() { return completionRule; }
    public void setCompletionRule(String completionRule) { this.completionRule = completionRule; }
    public String getMediaReference() { return mediaReference; }
    public void setMediaReference(String mediaReference) { this.mediaReference = mediaReference; }
    public ContentStatus getStatus() { return status; }
    public void setStatus(ContentStatus status) { this.status = status; }

    public String getSubtitleUrl() { return subtitleUrl; }
    public void setSubtitleUrl(String subtitleUrl) { this.subtitleUrl = subtitleUrl; }
    public SubtitleStatus getSubtitleStatus() { return subtitleStatus; }
    public void setSubtitleStatus(SubtitleStatus subtitleStatus) { this.subtitleStatus = subtitleStatus; }
    public String getSubtitleLanguage() { return subtitleLanguage; }
    public void setSubtitleLanguage(String subtitleLanguage) { this.subtitleLanguage = subtitleLanguage; }
    public String getSubtitleSourceLanguage() { return subtitleSourceLanguage; }
    public void setSubtitleSourceLanguage(String subtitleSourceLanguage) { this.subtitleSourceLanguage = subtitleSourceLanguage; }
    public Instant getSubtitleGeneratedAt() { return subtitleGeneratedAt; }
    public void setSubtitleGeneratedAt(Instant subtitleGeneratedAt) { this.subtitleGeneratedAt = subtitleGeneratedAt; }
    public String getSubtitleError() { return subtitleError; }
    public void setSubtitleError(String subtitleError) { this.subtitleError = subtitleError; }
    public int getSubtitleProgress() { return subtitleProgress; }
    public void setSubtitleProgress(int subtitleProgress) { this.subtitleProgress = subtitleProgress; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

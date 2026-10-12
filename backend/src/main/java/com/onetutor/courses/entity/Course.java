package com.onetutor.courses.entity;

import com.onetutor.categories.entity.Category;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "courses")
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "short_desc", length = 500)
    private String shortDesc;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 1000)
    private String thumbnail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    private String level;
    private String duration;
    private String language;

    @Column(columnDefinition = "TEXT")
    private String prerequisites;

    @Column(name = "learning_outcomes", columnDefinition = "TEXT")
    private String learningOutcomes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CourseStatus status = CourseStatus.draft;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "sequential_video_enabled", nullable = false)
    private boolean sequentialVideoEnabled = true;

    @Column(name = "require_video_completion", nullable = false)
    private boolean requireVideoCompletion = true;

    @Column(name = "sequential_lesson_unlocking", nullable = false)
    private boolean sequentialLessonUnlocking = true;

    @Column(name = "pause_on_tab_inactive", nullable = false)
    private boolean pauseOnTabInactive = true;

    @Column(name = "video_completion_threshold", nullable = false)
    private int videoCompletionThreshold = 95;

    @Column(name = "progress_save_interval", nullable = false)
    private int progressSaveInterval = 8;

    @Column(name = "pending_edits", columnDefinition = "TEXT")
    private String pendingEdits;

    @Column(name = "pending_approval", nullable = false)
    private boolean pendingApproval = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    // getters/setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getShortDesc() { return shortDesc; }
    public void setShortDesc(String shortDesc) { this.shortDesc = shortDesc; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getThumbnail() { return thumbnail; }
    public void setThumbnail(String thumbnail) { this.thumbnail = thumbnail; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getPrerequisites() { return prerequisites; }
    public void setPrerequisites(String prerequisites) { this.prerequisites = prerequisites; }
    public String getLearningOutcomes() { return learningOutcomes; }
    public void setLearningOutcomes(String learningOutcomes) { this.learningOutcomes = learningOutcomes; }
    public CourseStatus getStatus() { return status; }
    public void setStatus(CourseStatus status) { this.status = status; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public boolean isSequentialVideoEnabled() { return sequentialVideoEnabled; }
    public void setSequentialVideoEnabled(boolean sequentialVideoEnabled) { this.sequentialVideoEnabled = sequentialVideoEnabled; }
    public boolean isRequireVideoCompletion() { return requireVideoCompletion; }
    public void setRequireVideoCompletion(boolean requireVideoCompletion) { this.requireVideoCompletion = requireVideoCompletion; }
    public boolean isSequentialLessonUnlocking() { return sequentialLessonUnlocking; }
    public void setSequentialLessonUnlocking(boolean sequentialLessonUnlocking) { this.sequentialLessonUnlocking = sequentialLessonUnlocking; }
    public boolean isPauseOnTabInactive() { return pauseOnTabInactive; }
    public void setPauseOnTabInactive(boolean pauseOnTabInactive) { this.pauseOnTabInactive = pauseOnTabInactive; }
    public int getVideoCompletionThreshold() { return videoCompletionThreshold; }
    public void setVideoCompletionThreshold(int videoCompletionThreshold) { this.videoCompletionThreshold = videoCompletionThreshold; }
    public int getProgressSaveInterval() { return progressSaveInterval; }
    public void setProgressSaveInterval(int progressSaveInterval) { this.progressSaveInterval = progressSaveInterval; }
    public String getPendingEdits() { return pendingEdits; }
    public void setPendingEdits(String pendingEdits) { this.pendingEdits = pendingEdits; }
    public boolean isPendingApproval() { return pendingApproval; }
    public void setPendingApproval(boolean pendingApproval) { this.pendingApproval = pendingApproval; }
    @Column(name = "pricing_type", nullable = false, length = 30)
    private String pricingType = "free";

    @Column(nullable = false)
    private java.math.BigDecimal price = java.math.BigDecimal.ZERO;

    @Column(nullable = false, length = 10)
    private String currency = "INR";

    @Column(name = "subscription_period", nullable = false, length = 30)
    private String subscriptionPeriod = "lifetime";

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public String getPricingType() { return pricingType; }
    public void setPricingType(String pricingType) { this.pricingType = pricingType; }
    public java.math.BigDecimal getPrice() { return price; }
    public void setPrice(java.math.BigDecimal price) { this.price = price != null ? price : java.math.BigDecimal.ZERO; }
    public void setPrice(Double price) { this.price = price != null ? java.math.BigDecimal.valueOf(price) : java.math.BigDecimal.ZERO; }
    public Double getPriceDouble() { return price != null ? price.doubleValue() : 0.0; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getSubscriptionPeriod() { return subscriptionPeriod; }
    public void setSubscriptionPeriod(String subscriptionPeriod) { this.subscriptionPeriod = subscriptionPeriod; }
}

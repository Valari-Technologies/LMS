package com.onetutor.notifications.entity;

import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "broadcast_notifications")
public class BroadcastNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false, length = 50)
    private String type = "SYSTEM";

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "link_url", length = 500)
    private String linkUrl;

    @Column(name = "target_role", nullable = false, length = 50)
    private String targetRole = "ALL";

    @Column(name = "recipient_count", nullable = false)
    private int recipientCount = 0;

    @Column(name = "fcm_success_count", nullable = false)
    private int fcmSuccessCount = 0;

    @Column(name = "fcm_failure_count", nullable = false)
    private int fcmFailureCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sent_by")
    private User sentBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getLinkUrl() { return linkUrl; }
    public void setLinkUrl(String linkUrl) { this.linkUrl = linkUrl; }
    public String getTargetRole() { return targetRole; }
    public void setTargetRole(String targetRole) { this.targetRole = targetRole; }
    public int getRecipientCount() { return recipientCount; }
    public void setRecipientCount(int recipientCount) { this.recipientCount = recipientCount; }
    public int getFcmSuccessCount() { return fcmSuccessCount; }
    public void setFcmSuccessCount(int fcmSuccessCount) { this.fcmSuccessCount = fcmSuccessCount; }
    public int getFcmFailureCount() { return fcmFailureCount; }
    public void setFcmFailureCount(int fcmFailureCount) { this.fcmFailureCount = fcmFailureCount; }
    public User getSentBy() { return sentBy; }
    public void setSentBy(User sentBy) { this.sentBy = sentBy; }
    public Instant getCreatedAt() { return createdAt; }
}

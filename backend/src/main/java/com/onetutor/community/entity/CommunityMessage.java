package com.onetutor.community.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "community_messages")
public class CommunityMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false, length = 20)
    private MessageType messageType = MessageType.text;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_asset_id")
    private MediaAsset mediaAsset;

    @Column(nullable = false)
    private boolean deleted = false;

    @Column(name = "deleted_by_admin", nullable = false)
    private boolean deletedByAdmin = false;

    @Column(nullable = false)
    private boolean edited = false;

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

    // Getters and setters
    public Long getId() { return id; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public MessageType getMessageType() { return messageType; }
    public void setMessageType(MessageType messageType) { this.messageType = messageType; }
    public MediaAsset getMediaAsset() { return mediaAsset; }
    public void setMediaAsset(MediaAsset mediaAsset) { this.mediaAsset = mediaAsset; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public boolean isDeletedByAdmin() { return deletedByAdmin; }
    public void setDeletedByAdmin(boolean deletedByAdmin) { this.deletedByAdmin = deletedByAdmin; }
    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

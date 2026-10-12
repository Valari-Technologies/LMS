package com.onetutor.community.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "community_read_status", uniqueConstraints = {
        @UniqueConstraint(name = "uq_community_read_user_course", columnNames = {"user_id", "course_id"})
})
public class CommunityReadStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "last_read_message_id", nullable = false)
    private Long lastReadMessageId = 0L;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt = Instant.now();

    public CommunityReadStatus() {}

    public CommunityReadStatus(User user, Course course, Long lastReadMessageId) {
        this.user = user;
        this.course = course;
        this.lastReadMessageId = lastReadMessageId != null ? lastReadMessageId : 0L;
        this.lastReadAt = Instant.now();
    }

    // Getters and setters
    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public Long getLastReadMessageId() { return lastReadMessageId; }
    public void setLastReadMessageId(Long lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }
    public Instant getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(Instant lastReadAt) { this.lastReadAt = lastReadAt; }
}

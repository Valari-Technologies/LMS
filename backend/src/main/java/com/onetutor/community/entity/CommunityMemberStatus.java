package com.onetutor.community.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "community_member_status", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"course_id", "user_id"})
})
public class CommunityMemberStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "is_disabled", nullable = false)
    private boolean disabled = false;

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public CommunityMemberStatus() {}

    public CommunityMemberStatus(Course course, User user, boolean disabled) {
        this.course = course;
        this.user = user;
        this.disabled = disabled;
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Course getCourse() {
        return course;
    }

    public void setCourse(Course course) {
        this.course = course;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public boolean isDisabled() {
        return disabled;
    }

    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
        this.updatedAt = Instant.now();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}

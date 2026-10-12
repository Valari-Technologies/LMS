package com.onetutor.community.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "community_disabled_intervals")
public class CommunityDisabledInterval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "disabled_at", nullable = false)
    private Instant disabledAt = Instant.now();

    @Column(name = "enabled_at")
    private Instant enabledAt;

    public CommunityDisabledInterval() {}

    public CommunityDisabledInterval(Course course, User user, Instant disabledAt) {
        this.course = course;
        this.user = user;
        this.disabledAt = disabledAt != null ? disabledAt : Instant.now();
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

    public Instant getDisabledAt() {
        return disabledAt;
    }

    public void setDisabledAt(Instant disabledAt) {
        this.disabledAt = disabledAt;
    }

    public Instant getEnabledAt() {
        return enabledAt;
    }

    public void setEnabledAt(Instant enabledAt) {
        this.enabledAt = enabledAt;
    }
}

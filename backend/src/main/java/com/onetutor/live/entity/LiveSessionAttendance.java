package com.onetutor.live.entity;

import com.onetutor.batches.entity.Batch;
import com.onetutor.courses.entity.Course;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "live_session_attendance", uniqueConstraints = {
        @UniqueConstraint(name = "uq_session_attendance_student", columnNames = {"session_id", "student_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class LiveSessionAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private LiveSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private Batch batch;

    @Column(nullable = false, length = 30)
    private String status = "PRESENT";

    @Column(name = "attended_at", nullable = false)
    private Instant attendedAt;

    @Column(name = "join_time")
    private Instant joinTime;

    @Column(name = "leave_time")
    private Instant leaveTime;

    @Column(name = "duration_seconds")
    private Integer durationSeconds = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.attendedAt == null) {
            this.attendedAt = Instant.now();
        }
        if (this.joinTime == null) {
            this.joinTime = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}

package com.onetutor.enrollment.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "enrollments")
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private com.onetutor.batches.entity.Batch batch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EnrollmentStatus status = EnrollmentStatus.active;

    @Column(name = "enrolled_at", nullable = false)
    private Instant enrolledAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "pricing_type", length = 30)
    private String pricingType = "free";

    @Column(name = "amount_paid")
    private java.math.BigDecimal amountPaid = java.math.BigDecimal.ZERO;

    @PrePersist
    void onCreate() { enrolledAt = Instant.now(); }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public com.onetutor.batches.entity.Batch getBatch() { return batch; }
    public void setBatch(com.onetutor.batches.entity.Batch batch) { this.batch = batch; }
    public EnrollmentStatus getStatus() { return status; }
    public void setStatus(EnrollmentStatus status) { this.status = status; }
    public Instant getEnrolledAt() { return enrolledAt; }
    public Instant getRemovedAt() { return removedAt; }
    public void setRemovedAt(Instant removedAt) { this.removedAt = removedAt; }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public String getPricingType() { return pricingType; }
    public void setPricingType(String pricingType) { this.pricingType = pricingType; }
    public java.math.BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(java.math.BigDecimal amountPaid) { this.amountPaid = amountPaid != null ? amountPaid : java.math.BigDecimal.ZERO; }
    public void setAmountPaid(Double amountPaid) { this.amountPaid = amountPaid != null ? java.math.BigDecimal.valueOf(amountPaid) : java.math.BigDecimal.ZERO; }
    public Double getAmountPaidDouble() { return amountPaid != null ? amountPaid.doubleValue() : 0.0; }
}

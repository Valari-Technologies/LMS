package com.onetutor.payment.entity;

import com.onetutor.courses.entity.Course;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.users.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "payments")
public class Payment {

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
    @JoinColumn(name = "enrollment_id")
    private Enrollment enrollment;

    @Column(nullable = false)
    private java.math.BigDecimal amount = java.math.BigDecimal.ZERO;

    @Column(nullable = false, length = 10)
    private String currency = "INR";

    @Column(name = "payment_method", nullable = false, length = 50)
    private String paymentMethod = "CARD";

    @Column(name = "transaction_id", nullable = false, unique = true, length = 100)
    private String transactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentStatus status = PaymentStatus.SUCCESS;

    @Column(name = "pricing_type", nullable = false, length = 30)
    private String pricingType = "subscription";

    @Column(name = "subscription_period", length = 30)
    private String subscriptionPeriod = "lifetime";

    @Column(name = "payment_details", columnDefinition = "TEXT")
    private String paymentDetails;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public Enrollment getEnrollment() { return enrollment; }
    public void setEnrollment(Enrollment enrollment) { this.enrollment = enrollment; }
    public java.math.BigDecimal getAmount() { return amount; }
    public void setAmount(java.math.BigDecimal amount) { this.amount = amount != null ? amount : java.math.BigDecimal.ZERO; }
    public void setAmount(Double amount) { this.amount = amount != null ? java.math.BigDecimal.valueOf(amount) : java.math.BigDecimal.ZERO; }
    public Double getAmountDouble() { return amount != null ? amount.doubleValue() : 0.0; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public String getPricingType() { return pricingType; }
    public void setPricingType(String pricingType) { this.pricingType = pricingType; }
    public String getSubscriptionPeriod() { return subscriptionPeriod; }
    public void setSubscriptionPeriod(String subscriptionPeriod) { this.subscriptionPeriod = subscriptionPeriod; }
    public String getPaymentDetails() { return paymentDetails; }
    public void setPaymentDetails(String paymentDetails) { this.paymentDetails = paymentDetails; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

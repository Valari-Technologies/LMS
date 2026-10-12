package com.onetutor.payment.dto;

import com.onetutor.payment.entity.Payment;
import java.time.Instant;

public record PaymentResponse(
        Long id,
        Long studentId,
        String studentName,
        String studentEmail,
        Long courseId,
        String courseName,
        String courseThumbnail,
        Long enrollmentId,
        Double amount,
        String currency,
        String paymentMethod,
        String transactionId,
        String status,
        String pricingType,
        String subscriptionPeriod,
        String paymentDetails,
        Instant createdAt
) {
    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(
                p.getId(),
                p.getStudent() != null ? p.getStudent().getId() : null,
                p.getStudent() != null ? p.getStudent().getName() : "Unknown Student",
                p.getStudent() != null ? p.getStudent().getEmail() : "",
                p.getCourse() != null ? p.getCourse().getId() : null,
                p.getCourse() != null ? p.getCourse().getName() : "Unknown Course",
                p.getCourse() != null ? p.getCourse().getThumbnail() : null,
                p.getEnrollment() != null ? p.getEnrollment().getId() : null,
                p.getAmountDouble(),
                p.getCurrency(),
                p.getPaymentMethod(),
                p.getTransactionId(),
                p.getStatus() != null ? p.getStatus().name() : "SUCCESS",
                p.getPricingType(),
                p.getSubscriptionPeriod(),
                p.getPaymentDetails(),
                p.getCreatedAt()
        );
    }
}

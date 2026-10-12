package com.onetutor.payment.dto;

import jakarta.validation.constraints.NotNull;

public record CheckoutRequest(
        @NotNull(message = "Course ID is required")
        Long courseId,

        Long batchId,

        Double amount,

        String currency,

        String paymentMethod,

        String transactionId,

        String paymentDetails,

        String couponCode,

        Double couponDiscount
) {}

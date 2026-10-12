package com.onetutor.payment.dto;

import jakarta.validation.constraints.NotNull;

public record RazorpayOrderRequest(
        @NotNull(message = "Course ID is required")
        Long courseId,

        Long batchId,

        Double amount,

        String currency,

        String couponCode
) {}

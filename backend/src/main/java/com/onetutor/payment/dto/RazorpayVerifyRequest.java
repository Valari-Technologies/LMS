package com.onetutor.payment.dto;

import jakarta.validation.constraints.NotNull;

public record RazorpayVerifyRequest(
        @NotNull(message = "Course ID is required")
        Long courseId,

        Long batchId,

        Double amount,

        String currency,

        @NotNull(message = "Razorpay Order ID is required")
        String razorpayOrderId,

        @NotNull(message = "Razorpay Payment ID is required")
        String razorpayPaymentId,

        String razorpaySignature,

        String couponCode
) {}

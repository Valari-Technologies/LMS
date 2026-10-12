package com.onetutor.payment.dto;

public record RazorpayOrderResponse(
        String orderId,
        Double amount,
        Long amountInPaise,
        String currency,
        String keyId,
        String courseName,
        String studentName,
        String studentEmail,
        boolean isLiveMode,
        boolean isConfigured
) {}

package com.onetutor.payment.dto;

public record PaymentStatsResponse(
        Double totalRevenue,
        long totalSuccessfulTransactions,
        long totalFailedTransactions
) {}

package com.onetutor.coupons.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CouponValidateRequest(
        @NotBlank(message = "Coupon code is required")
        String code,

        @NotNull(message = "Original amount is required")
        BigDecimal amount,

        Long courseId
) {
}

package com.onetutor.coupons.dto;

import com.onetutor.coupons.entity.CouponScope;
import com.onetutor.coupons.entity.DiscountType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record CouponRequest(
        @NotBlank(message = "Coupon code is required")
        @Pattern(regexp = "^[A-Za-z0-9_-]{3,50}$", message = "Coupon code must be 3-50 alphanumeric characters, underscores or hyphens")
        String code,

        @NotNull(message = "Discount type is required")
        DiscountType discountType,

        @NotNull(message = "Discount value is required")
        @DecimalMin(value = "0.01", message = "Discount value must be greater than 0")
        BigDecimal discountValue,

        CouponScope scope,

        Long categoryId,

        Long courseId,

        List<Long> categoryIds,

        List<Long> courseIds,

        BigDecimal minPurchaseAmount,

        BigDecimal maxDiscountAmount,

        Instant startDate,

        Instant expiryDate,

        Integer usageLimit,

        Integer perUserLimit,

        Boolean active,

        String description
) {
}

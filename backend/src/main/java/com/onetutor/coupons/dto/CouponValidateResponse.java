package com.onetutor.coupons.dto;

import com.onetutor.coupons.entity.DiscountType;

import java.math.BigDecimal;

public record CouponValidateResponse(
        boolean valid,
        String code,
        DiscountType discountType,
        BigDecimal discountValue,
        BigDecimal discount,
        BigDecimal finalPrice,
        String message,
        String description
) {
    public static CouponValidateResponse invalid(String message) {
        return new CouponValidateResponse(false, null, null, null, BigDecimal.ZERO, BigDecimal.ZERO, message, null);
    }
}

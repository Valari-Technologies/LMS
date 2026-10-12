package com.onetutor.coupons.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.coupons.dto.CouponResponse;
import com.onetutor.coupons.dto.CouponValidateRequest;
import com.onetutor.coupons.dto.CouponValidateResponse;
import com.onetutor.coupons.service.CouponService;
import com.onetutor.users.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
@Tag(name = "Coupons", description = "Public & student coupon validation and active listing")
public class PublicCouponController {

    private final CouponService couponService;

    @GetMapping("/available")
    @Operation(summary = "List currently active and valid promotional coupons")
    public ApiResponse<List<CouponResponse>> getAvailableCoupons() {
        return ApiResponse.ok(couponService.getActiveAvailableCoupons());
    }

    @PostMapping("/validate")
    @Operation(summary = "Validate a coupon code and calculate discounted pricing")
    public ApiResponse<CouponValidateResponse> validateCoupon(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CouponValidateRequest req) {
        CouponValidateResponse response = couponService.validateCoupon(req, user);
        return ApiResponse.ok(response);
    }
}

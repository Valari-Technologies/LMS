package com.onetutor.coupons.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.coupons.dto.CouponRequest;
import com.onetutor.coupons.dto.CouponResponse;
import com.onetutor.coupons.service.CouponService;
import com.onetutor.users.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/coupons")
@RequiredArgsConstructor
@Tag(name = "Admin Coupons", description = "Coupon CRUD operations for Super Admin and Administrators")
public class AdminCouponController {

    private final CouponService couponService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'READONLY_ADMIN')")
    @Operation(summary = "List all coupons with optional search, status filter and pagination")
    public ApiResponse<PageResponse<CouponResponse>> listCoupons(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        Page<CouponResponse> result = couponService.getCoupons(search, active, pageable);
        return ApiResponse.ok(PageResponse.from(result));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'READONLY_ADMIN')")
    @Operation(summary = "Get single coupon details by ID")
    public ApiResponse<CouponResponse> getCoupon(@PathVariable Long id) {
        return ApiResponse.ok(couponService.getCouponById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Create a new coupon")
    public ResponseEntity<ApiResponse<CouponResponse>> createCoupon(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CouponRequest req) {
        CouponResponse created = couponService.createCoupon(req, user);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Coupon created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Update an existing coupon")
    public ApiResponse<CouponResponse> updateCoupon(
            @PathVariable Long id,
            @Valid @RequestBody CouponRequest req) {
        CouponResponse updated = couponService.updateCoupon(id, req);
        return ApiResponse.ok("Coupon updated successfully", updated);
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Toggle active status of a coupon")
    public ApiResponse<CouponResponse> toggleStatus(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Boolean> body) {
        Boolean active = (body != null && body.containsKey("active")) ? body.get("active") : null;
        CouponResponse updated = couponService.toggleCouponStatus(id, active);
        String msg = updated.active() ? "Coupon activated successfully" : "Coupon deactivated successfully";
        return ApiResponse.ok(msg, updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Delete coupon permanently")
    public ApiResponse<Void> deleteCoupon(@PathVariable Long id) {
        couponService.deleteCoupon(id);
        return ApiResponse.ok("Coupon deleted successfully", null);
    }
}

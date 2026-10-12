package com.onetutor.payment.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.payment.dto.*;
import com.onetutor.payment.service.PaymentService;
import com.onetutor.payment.service.RazorpayService;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final RazorpayService razorpayService;

    public PaymentController(PaymentService paymentService, RazorpayService razorpayService) {
        this.paymentService = paymentService;
        this.razorpayService = razorpayService;
    }

    @GetMapping("/razorpay/config")
    public ApiResponse<Map<String, Object>> getRazorpayConfig() {
        return ApiResponse.ok(razorpayService.getConfig());
    }

    @PostMapping("/checkout")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<PaymentResponse> checkout(
            @Valid @RequestBody CheckoutRequest req,
            @AuthenticationPrincipal User student) {
        return ApiResponse.ok("Payment confirmed and enrolled successfully", paymentService.processCheckout(req, student));
    }

    @PostMapping("/razorpay/create-order")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<RazorpayOrderResponse> createRazorpayOrder(
            @Valid @RequestBody RazorpayOrderRequest req,
            @AuthenticationPrincipal User student) {
        return ApiResponse.ok("Razorpay order generated successfully", razorpayService.createOrder(req, student));
    }

    @PostMapping("/razorpay/verify")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<PaymentResponse> verifyRazorpayPayment(
            @Valid @RequestBody RazorpayVerifyRequest req,
            @AuthenticationPrincipal User student) {
        return ApiResponse.ok("Payment verified and enrolled successfully via Razorpay", razorpayService.verifyPayment(req, student));
    }

    @GetMapping("/my-payments")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<PageResponse<PaymentResponse>> myPayments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User student) {
        return ApiResponse.ok(paymentService.getMyPayments(student, PageRequest.of(page, size)));
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
    public ApiResponse<PageResponse<PaymentResponse>> adminList(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(paymentService.getAdminPayments(search, PageRequest.of(page, size)));
    }

    @GetMapping("/admin/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
    public ApiResponse<PaymentStatsResponse> adminStats() {
        return ApiResponse.ok(paymentService.getPaymentStats());
    }
}

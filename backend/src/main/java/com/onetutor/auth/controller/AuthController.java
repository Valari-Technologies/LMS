package com.onetutor.auth.controller;

import com.onetutor.auth.dto.*;
import com.onetutor.auth.service.AuthService;
import com.onetutor.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Void>> register(@Valid @RequestBody RegisterRequest req) {
        authService.register(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Registration successful. Please check your email to verify your account.", null));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(ApiResponse.ok("Email verified successfully. You can now log in.", null));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        AuthResponse response = authService.login(req);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshRequest req) {
        AuthResponse response = authService.refresh(req.refreshToken());
        return ResponseEntity.ok(ApiResponse.ok("Token refreshed", response));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@Valid @RequestBody RefreshRequest req) {
        authService.logout(req.refreshToken());
        return ResponseEntity.ok(ApiResponse.ok("Logged out", null));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPassword(req.email());
        return ResponseEntity.ok(ApiResponse.ok(
                "If an account with that email exists, a reset link has been sent.", null));
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(@Valid @RequestBody GoogleAuthRequest req) {
        AuthResponse response = authService.loginWithGoogle(req);
        return ResponseEntity.ok(ApiResponse.ok("Google sign-in successful", response));
    }

    @PostMapping("/register-otp/send")
    public ResponseEntity<ApiResponse<OtpResponse>> sendRegisterOtp(@Valid @RequestBody SendOtpRequest req) {
        OtpResponse response = authService.sendRegistrationOtp(req.email());
        return ResponseEntity.ok(ApiResponse.ok(response.message(), response));
    }

    @PostMapping("/register-otp/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyRegisterOtp(@Valid @RequestBody VerifyRegisterOtpRequest req) {
        AuthResponse response = authService.verifyRegistrationOtp(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Account verified and registered successfully", response));
    }

    @PostMapping("/forgot-password-otp/send")
    public ResponseEntity<ApiResponse<OtpResponse>> sendForgotPasswordOtp(@Valid @RequestBody SendOtpRequest req) {
        OtpResponse response = authService.sendPasswordResetOtp(req.email());
        return ResponseEntity.ok(ApiResponse.ok(response.message(), response));
    }

    @PostMapping("/forgot-password-otp/verify")
    public ResponseEntity<ApiResponse<Void>> verifyForgotPasswordOtp(@Valid @RequestBody VerifyResetPasswordOtpRequest req) {
        authService.verifyPasswordResetOtp(req);
        return ResponseEntity.ok(ApiResponse.ok("Password reset successfully. You can now log in.", null));
    }

    @PostMapping("/login-otp/send")
    public ResponseEntity<ApiResponse<OtpResponse>> sendLoginOtp(@Valid @RequestBody SendOtpRequest req) {
        OtpResponse response = authService.sendLoginOtp(req.email());
        return ResponseEntity.ok(ApiResponse.ok(response.message(), response));
    }

    @PostMapping("/login-otp/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyLoginOtp(@Valid @RequestBody VerifyLoginOtpRequest req) {
        AuthResponse response = authService.verifyLoginOtp(req);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/test-email")
    public ResponseEntity<ApiResponse<Void>> testEmail(@RequestParam(required = false) String email) {
        authService.sendTestEmail(email);
        return ResponseEntity.ok(ApiResponse.ok("Test email dispatched successfully", null));
    }
}


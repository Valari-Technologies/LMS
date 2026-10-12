package com.onetutor.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyResetPasswordOtpRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6, max = 6, message = "OTP must be 6 digits") String otp,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String newPassword
) {}

package com.onetutor.auth.dto;

public record OtpResponse(
        String message,
        String devOtp
) {}

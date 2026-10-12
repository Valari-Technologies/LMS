package com.onetutor.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record GoogleAuthRequest(
        String idToken,
        @NotBlank @Email String email,
        @NotBlank String name,
        String picture
) {}

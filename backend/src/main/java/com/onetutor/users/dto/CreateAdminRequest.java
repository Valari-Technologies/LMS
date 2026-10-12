package com.onetutor.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAdminRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 100)
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        String role,

        String permissions
) {
    public CreateAdminRequest(String name, String email, String password) {
        this(name, email, password, "super_admin", null);
    }
}

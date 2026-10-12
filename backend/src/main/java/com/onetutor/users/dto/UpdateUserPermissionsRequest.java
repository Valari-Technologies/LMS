package com.onetutor.users.dto;

public record UpdateUserPermissionsRequest(
        String role,
        String permissions
) {}

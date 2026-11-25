package com.onetutor.users.controller;

import com.onetutor.auth.dto.UserSummary;
import com.onetutor.common.ApiResponse;
import com.onetutor.users.dto.UpdateProfileRequest;
import com.onetutor.users.entity.User;
import com.onetutor.users.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ApiResponse<UserSummary> me(@AuthenticationPrincipal User user) {
        String displayName = user.getName();
        if (displayName == null || displayName.equalsIgnoreCase("Super Admin")
                || displayName.toLowerCase().contains("super admin")
                || (user.getRole() == com.onetutor.users.entity.UserRole.super_admin && "Admin".equalsIgnoreCase(displayName))) {
            displayName = "One Tutor";
        }
        UserSummary summary = new UserSummary(
                user.getId(), displayName, user.getEmail(),
                user.getRole().name(), user.isEmailVerified(), user.getProfileImage(), user.getPermissions());
        return ApiResponse.ok(summary);
    }

    @PutMapping("/me")
    public ApiResponse<UserSummary> updateProfile(@AuthenticationPrincipal User user,
                                                  @RequestBody UpdateProfileRequest req) {
        return ApiResponse.ok("Profile updated successfully", userService.updateProfile(user, req));
    }

    @PostMapping("/heartbeat")
    public ApiResponse<Void> heartbeat(@AuthenticationPrincipal User user) {
        if (user != null) {
            userService.updateLastActive(user.getId());
        }
        return ApiResponse.ok(null);
    }
}

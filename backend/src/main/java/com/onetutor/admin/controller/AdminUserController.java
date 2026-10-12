package com.onetutor.admin.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.users.dto.CreateAdminRequest;
import com.onetutor.users.dto.StudentDetailResponse;
import com.onetutor.users.dto.UserResponse;
import com.onetutor.users.entity.User;
import com.onetutor.users.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/students")
    public ApiResponse<PageResponse<UserResponse>> listStudents(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(userService.listStudents(search, status, PageRequest.of(page, size)));
    }

    @GetMapping("/students/online-count")
    public ApiResponse<Long> getOnlineStudentCount() {
        return ApiResponse.ok(userService.countOnlineStudents());
    }

    @GetMapping("/students/{id}")
    public ApiResponse<StudentDetailResponse> getStudentDetail(@PathVariable Long id) {
        return ApiResponse.ok(userService.getStudentDetail(id));
    }

    @PostMapping("/students/{id}/disable")
    public ApiResponse<UserResponse> disableStudent(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Student disabled successfully", userService.disableStudent(id, actor));
    }

    @PostMapping("/students/{id}/enable")
    public ApiResponse<UserResponse> enableStudent(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Student enabled successfully", userService.enableStudent(id, actor));
    }

    @GetMapping("/admins")
    public ApiResponse<PageResponse<UserResponse>> listAdmins(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(userService.listAdmins(PageRequest.of(page, size)));
    }

    @PostMapping("/admins")
    public ApiResponse<UserResponse> createAdmin(@Valid @RequestBody CreateAdminRequest req,
                                                 @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Account created successfully", userService.createAdmin(req, actor));
    }

    @PostMapping("/users/{id}/disable")
    public ApiResponse<UserResponse> disableUser(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Account disabled successfully", userService.disableUser(id, actor));
    }

    @PostMapping("/users/{id}/enable")
    public ApiResponse<UserResponse> enableUser(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Account enabled successfully", userService.enableUser(id, actor));
    }

    @PostMapping("/users/{id}/reset-password")
    public ApiResponse<UserResponse> resetUserPassword(@PathVariable Long id,
                                                       @Valid @RequestBody com.onetutor.users.dto.ResetPasswordRequest req,
                                                       @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Password reset successfully", userService.resetUserPassword(id, req.password(), actor));
    }

    @PutMapping("/users/{id}/permissions")
    public ApiResponse<UserResponse> updateUserPermissions(@PathVariable Long id,
                                                           @RequestBody com.onetutor.users.dto.UpdateUserPermissionsRequest req,
                                                           @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Permissions updated successfully", userService.updateUserPermissions(id, req, actor));
    }
}

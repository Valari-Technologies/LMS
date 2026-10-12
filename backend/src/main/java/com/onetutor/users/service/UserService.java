package com.onetutor.users.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.auth.dto.UserSummary;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.progress.service.ProgressService;
import com.onetutor.users.dto.CreateAdminRequest;
import com.onetutor.users.dto.StudentDetailResponse;
import com.onetutor.users.dto.UpdateProfileRequest;
import com.onetutor.users.dto.UpdateUserPermissionsRequest;
import com.onetutor.users.dto.UserResponse;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProgressService progressService;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       EnrollmentRepository enrollmentRepository,
                       ProgressService progressService,
                       AuditService auditService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.progressService = progressService;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserSummary updateProfile(User user, UpdateProfileRequest req) {
        User existing = userRepository.findById(user.getId())
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));

        if (req.name() != null && !req.name().isBlank()) {
            existing.setName(req.name().trim());
        }
        if (req.profileImage() != null) {
            existing.setProfileImage(req.profileImage().trim());
        }
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.currentPassword() == null || !passwordEncoder.matches(req.currentPassword(), existing.getPasswordHash())) {
                throw new BadRequestException("INVALID_PASSWORD", "Current password does not match");
            }
            if (req.newPassword().length() < 8) {
                throw new BadRequestException("PASSWORD_TOO_SHORT", "New password must be at least 8 characters");
            }
            existing.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        }

        userRepository.save(existing);
        return new UserSummary(
                existing.getId(),
                existing.getName(),
                existing.getEmail(),
                existing.getRole().name(),
                existing.isEmailVerified(),
                existing.getProfileImage(),
                existing.getPermissions()
        );
    }

    @Transactional
    public void updateLastActive(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setLastActiveAt(java.time.Instant.now());
            userRepository.save(u);
        });
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> listStudents(String search, String statusStr, Pageable pageable) {
        boolean isOnlineOnly = "ONLINE".equalsIgnoreCase(statusStr);
        UserStatus status = null;
        if (statusStr != null && !statusStr.isBlank() && !statusStr.equalsIgnoreCase("ALL") && !isOnlineOnly) {
            try {
                status = UserStatus.valueOf(statusStr.toLowerCase());
            } catch (IllegalArgumentException ignored) {}
        }
        String cleanSearch = (search == null || search.isBlank()) ? null : search.trim();
        java.time.Instant cutoff = java.time.Instant.now().minusSeconds(75);

        Page<User> page;
        if (isOnlineOnly) {
            if (cleanSearch != null) {
                page = userRepository.searchByRoleAndOnlineAndText(UserRole.student, cutoff, cleanSearch, pageable);
            } else {
                page = userRepository.findByRoleAndOnline(UserRole.student, cutoff, pageable);
            }
        } else if (cleanSearch != null && status != null) {
            page = userRepository.searchByRoleAndStatusAndText(UserRole.student, status, cleanSearch, pageable);
        } else if (cleanSearch != null) {
            page = userRepository.searchByRoleAndText(UserRole.student, cleanSearch, pageable);
        } else if (status != null) {
            page = userRepository.findByRoleAndStatus(UserRole.student, status, pageable);
        } else {
            page = userRepository.findByRole(UserRole.student, pageable);
        }
        return PageResponse.from(page.map(UserResponse::from));
    }

    @Transactional(readOnly = true)
    public long countOnlineStudents() {
        return userRepository.countByRoleAndOnline(UserRole.student, java.time.Instant.now().minusSeconds(75));
    }

    @Transactional(readOnly = true)
    public StudentDetailResponse getStudentDetail(Long studentId) {
        User student = userRepository.findById(studentId)
                .filter(u -> u.getRole() == UserRole.student)
                .orElseThrow(() -> new NotFoundException("STUDENT_NOT_FOUND", "Student not found"));

        var enrollments = enrollmentRepository.findByStudentId(studentId);
        List<StudentDetailResponse.EnrolledCourseSummary> courseSummaries = enrollments.stream().map(e -> {
            var course = e.getCourse();
            var cp = progressService.getCourseProgressForStudent(course.getId(), studentId);
            return new StudentDetailResponse.EnrolledCourseSummary(
                    e.getId(),
                    course.getId(),
                    course.getName(),
                    course.getCategory() != null ? course.getCategory().getName() : null,
                    e.getStatus().name(),
                    e.getEnrolledAt(),
                    cp.progressPercent(),
                    cp.lastAccessedAt()
            );
        }).toList();

        return new StudentDetailResponse(
                student.getId(),
                student.getName(),
                student.getEmail(),
                student.getStatus().name(),
                student.getProfileImage(),
                student.isEmailVerified(),
                student.getCreatedAt(),
                courseSummaries.size(),
                courseSummaries
        );
    }

    @Transactional
    public UserResponse disableStudent(Long studentId, User actor) {
        User student = userRepository.findById(studentId)
                .filter(u -> u.getRole() == UserRole.student)
                .orElseThrow(() -> new NotFoundException("STUDENT_NOT_FOUND", "Student not found"));

        student.setStatus(UserStatus.disabled);
        userRepository.save(student);
        auditService.log(actor, "DISABLE_STUDENT", "User", student.getId(),
                "Disabled student " + student.getEmail());
        return UserResponse.from(student);
    }

    @Transactional
    public UserResponse enableStudent(Long studentId, User actor) {
        User student = userRepository.findById(studentId)
                .filter(u -> u.getRole() == UserRole.student)
                .orElseThrow(() -> new NotFoundException("STUDENT_NOT_FOUND", "Student not found"));

        student.setStatus(UserStatus.active);
        userRepository.save(student);
        auditService.log(actor, "ENABLE_STUDENT", "User", student.getId(),
                "Enabled student " + student.getEmail());
        return UserResponse.from(student);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> listAdmins(Pageable pageable) {
        Page<User> page = userRepository.findByRoleIn(java.util.List.of(UserRole.super_admin, UserRole.admin, UserRole.content_creator, UserRole.readonly_admin), pageable);
        return PageResponse.from(page.map(UserResponse::from));
    }

    @Transactional
    public UserResponse createAdmin(CreateAdminRequest req, User actor) {
        if (userRepository.existsByEmail(req.email().toLowerCase().trim())) {
            throw new BadRequestException("EMAIL_IN_USE", "An account with this email already exists");
        }
        User admin = new User();
        admin.setName(req.name().trim());
        admin.setEmail(req.email().toLowerCase().trim());
        admin.setPasswordHash(passwordEncoder.encode(req.password()));

        UserRole targetRole = UserRole.super_admin;
        if (req.role() != null && !req.role().isBlank()) {
            try {
                targetRole = UserRole.valueOf(req.role().toLowerCase().trim());
            } catch (IllegalArgumentException ignored) {}
        }
        admin.setRole(targetRole);
        admin.setPermissions(req.permissions());
        admin.setStatus(UserStatus.active);
        admin.setEmailVerified(true);
        userRepository.save(admin);

        auditService.log(actor, "CREATE_STAFF_ACCOUNT", "User", admin.getId(),
                "Created account " + admin.getEmail() + " with role " + targetRole);
        return UserResponse.from(admin);
    }

    @Transactional
    public UserResponse updateUserPermissions(Long userId, UpdateUserPermissionsRequest req, User actor) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));

        if (req.role() != null && !req.role().isBlank()) {
            try {
                target.setRole(UserRole.valueOf(req.role().toLowerCase().trim()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (req.permissions() != null) {
            target.setPermissions(req.permissions());
        }
        userRepository.save(target);

        if (actor != null) {
            auditService.log(actor, "UPDATE_USER_PERMISSIONS", "User", target.getId(),
                    "Updated permissions and role for " + target.getEmail());
        }
        return UserResponse.from(target);
    }

    @Transactional
    public UserResponse disableUser(Long userId, User actor) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
        if (actor != null && target.getId().equals(actor.getId())) {
            throw new BadRequestException("CANNOT_DISABLE_SELF", "You cannot disable your own account");
        }
        if (target.getRole() == UserRole.super_admin) {
            throw new BadRequestException("CANNOT_DISABLE_SUPER_ADMIN", "Super Admin accounts cannot be disabled");
        }
        target.setStatus(UserStatus.disabled);
        userRepository.save(target);
        if (actor != null) {
            auditService.log(actor, "DISABLE_USER", "User", target.getId(), "Disabled account " + target.getEmail());
        }
        return UserResponse.from(target);
    }

    @Transactional
    public UserResponse enableUser(Long userId, User actor) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
        target.setStatus(UserStatus.active);
        userRepository.save(target);
        if (actor != null) {
            auditService.log(actor, "ENABLE_USER", "User", target.getId(), "Enabled account " + target.getEmail());
        }
        return UserResponse.from(target);
    }

    @Transactional
    public UserResponse resetUserPassword(Long userId, String newPassword, User actor) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
        if (newPassword == null || newPassword.trim().length() < 8) {
            throw new BadRequestException("INVALID_PASSWORD", "Password must be at least 8 characters");
        }
        target.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        userRepository.save(target);
        if (actor != null) {
            auditService.log(actor, "RESET_PASSWORD", "User", target.getId(), "Reset password for " + target.getEmail());
        }
        return UserResponse.from(target);
    }
}

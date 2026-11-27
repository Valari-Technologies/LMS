package com.onetutor.users.service;

import com.onetutor.assessments.entity.AssessmentAttempt;
import com.onetutor.assessments.entity.AssessmentStatus;
import com.onetutor.assessments.repository.AssessmentAttemptRepository;
import com.onetutor.audit.service.AuditService;
import com.onetutor.auth.dto.UserSummary;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.live.entity.LiveSessionAttendance;
import com.onetutor.live.repository.LiveSessionAttendanceRepository;
import com.onetutor.progress.entity.Progress;
import com.onetutor.progress.repository.ProgressRepository;
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
    private final ProgressRepository progressRepository;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final LiveSessionAttendanceRepository liveSessionAttendanceRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       EnrollmentRepository enrollmentRepository,
                       ProgressService progressService,
                       ProgressRepository progressRepository,
                       AssessmentAttemptRepository assessmentAttemptRepository,
                       LiveSessionAttendanceRepository liveSessionAttendanceRepository,
                       AuditService auditService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.progressService = progressService;
        this.progressRepository = progressRepository;
        this.assessmentAttemptRepository = assessmentAttemptRepository;
        this.liveSessionAttendanceRepository = liveSessionAttendanceRepository;
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
        int totalCompletedCourses = 0;
        int totalInProgressCourses = 0;
        double sumProgress = 0.0;

        List<StudentDetailResponse.EnrolledCourseSummary> courseSummaries = new java.util.ArrayList<>();
        for (var e : enrollments) {
            var course = e.getCourse();
            var cp = progressService.getCourseProgressForStudent(course.getId(), studentId);

            double pPercent = cp.progressPercent();
            sumProgress += pPercent;
            if (pPercent >= 100.0) {
                totalCompletedCourses++;
            } else if (pPercent > 0.0) {
                totalInProgressCourses++;
            }

            List<StudentDetailResponse.SectionProgressSummary> sectionSummaries = cp.sections() != null
                    ? cp.sections().stream().map(s -> new StudentDetailResponse.SectionProgressSummary(
                            s.sectionId(),
                            s.sectionTitle(),
                            s.totalContents(),
                            s.completedContents(),
                            s.progressPercent()
                    )).toList()
                    : List.of();

            courseSummaries.add(new StudentDetailResponse.EnrolledCourseSummary(
                    e.getId(),
                    course.getId(),
                    course.getName(),
                    course.getCategory() != null ? course.getCategory().getName() : null,
                    e.getStatus().name(),
                    e.getEnrolledAt(),
                    pPercent,
                    cp.completedContents(),
                    cp.totalContents(),
                    cp.lastAccessedAt(),
                    sectionSummaries
            ));
        }

        // Progress records for watch time and lessons
        List<Progress> progressList = progressRepository.findByStudentIdOrderByLastAccessedAtDesc(studentId);
        int totalLessonsCompleted = (int) progressList.stream().filter(Progress::isCompleted).count();
        int totalWatchedSeconds = progressList.stream().mapToInt(Progress::getWatchedSeconds).sum();
        int totalLearningMinutes = totalWatchedSeconds / 60;
        if (totalLearningMinutes == 0 && totalLessonsCompleted > 0) {
            totalLearningMinutes = totalLessonsCompleted * 12;
        }

        double overallProgressPercent = enrollments.isEmpty() ? 0.0 : Math.round((sumProgress / enrollments.size()) * 10.0) / 10.0;

        // Assessment attempts
        List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByStudentIdOrderByStartedAtDesc(studentId);
        int totalQuizzesTaken = attempts.size();
        int quizzesPassed = 0;
        double totalScorePercent = 0.0;
        List<StudentDetailResponse.StudentAssessmentSummary> assessmentSummaries = new java.util.ArrayList<>();

        for (var a : attempts) {
            var assessment = a.getAssessment();
            var content = a.getContent();
            double passingPct = assessment != null ? assessment.getPassPercentage() : 60.0;
            boolean passed = a.getPercentage() >= passingPct && a.getStatus() == AssessmentStatus.COMPLETED;
            if (passed) quizzesPassed++;
            totalScorePercent += a.getPercentage();

            String courseName = (content != null && content.getSection() != null && content.getSection().getCourse() != null)
                    ? content.getSection().getCourse().getName()
                    : "Course Assessment";

            String testTitle = content != null ? content.getTitle() : "Module Assessment";

            assessmentSummaries.add(new StudentDetailResponse.StudentAssessmentSummary(
                    a.getId(),
                    assessment != null ? assessment.getId() : null,
                    testTitle,
                    courseName,
                    a.getObtainedMarks(),
                    a.getTotalQuestions(),
                    Math.round(a.getPercentage() * 10.0) / 10.0,
                    passingPct,
                    passed,
                    a.getStatus().name(),
                    a.getStartedAt(),
                    a.getSubmittedAt()
            ));
        }

        double averageQuizScore = totalQuizzesTaken > 0
                ? Math.round((totalScorePercent / totalQuizzesTaken) * 10.0) / 10.0
                : 0.0;

        // Attendance records
        List<LiveSessionAttendance> attendances = liveSessionAttendanceRepository.findByStudentIdOrderByAttendedAtDesc(studentId);
        int liveSessionsAttended = (int) attendances.stream().filter(att -> "PRESENT".equalsIgnoreCase(att.getStatus())).count();
        List<StudentDetailResponse.StudentAttendanceSummary> attendanceSummaries = attendances.stream().map(att ->
                new StudentDetailResponse.StudentAttendanceSummary(
                        att.getId(),
                        att.getSession() != null ? att.getSession().getId() : null,
                        att.getSession() != null ? att.getSession().getTitle() : "Live Class",
                        att.getCourse() != null ? att.getCourse().getName() : "Live Course",
                        att.getSession() != null ? att.getSession().getScheduledAt() : att.getAttendedAt(),
                        att.getJoinTime() != null ? att.getJoinTime() : att.getAttendedAt(),
                        att.getStatus()
                )
        ).toList();

        // Recent activity items
        List<StudentDetailResponse.StudentActivityItem> activityItems = new java.util.ArrayList<>();
        for (var p : progressList.stream().limit(6).toList()) {
            if (p.getLastAccessedAt() != null) {
                String cTitle = p.getContent() != null ? p.getContent().getTitle() : "Lesson Content";
                String action = p.isCompleted() ? "Completed lesson" : "Watched lesson";
                activityItems.add(new StudentDetailResponse.StudentActivityItem(
                        p.isCompleted() ? "LESSON_COMPLETED" : "LESSON_ACCESSED",
                        action + ": " + cTitle,
                        p.isCompleted() ? "100% completed" : (p.getProgressPercent() + "% progress (" + (p.getWatchedSeconds() / 60) + "m)"),
                        p.getLastAccessedAt(),
                        p.isCompleted() ? "fa-circle-check" : "fa-play"
                ));
            }
        }
        for (var a : attempts.stream().limit(4).toList()) {
            String aTitle = a.getContent() != null ? a.getContent().getTitle() : "Assessment";
            double passingPct = a.getAssessment() != null ? a.getAssessment().getPassPercentage() : 60.0;
            boolean p = a.getPercentage() >= passingPct;
            activityItems.add(new StudentDetailResponse.StudentActivityItem(
                    "ASSESSMENT",
                    (p ? "Passed" : "Attempted") + " " + aTitle,
                    "Score: " + Math.round(a.getPercentage()) + "% (" + (p ? "Passed" : "Needs Review") + ")",
                    a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getStartedAt(),
                    p ? "fa-award" : "fa-file-lines"
            ));
        }
        for (var att : attendances.stream().limit(4).toList()) {
            String sTitle = att.getSession() != null ? att.getSession().getTitle() : "Live Session";
            activityItems.add(new StudentDetailResponse.StudentActivityItem(
                    "LIVE_SESSION",
                    "Attended " + sTitle,
                    "Status: " + att.getStatus() + (att.getDurationSeconds() != null && att.getDurationSeconds() > 0 ? " (" + (att.getDurationSeconds() / 60) + "m)" : ""),
                    att.getJoinTime() != null ? att.getJoinTime() : att.getAttendedAt(),
                    "fa-video"
            ));
        }
        activityItems.sort((x, y) -> {
            if (x.timestamp() == null && y.timestamp() == null) return 0;
            if (x.timestamp() == null) return 1;
            if (y.timestamp() == null) return -1;
            return y.timestamp().compareTo(x.timestamp());
        });
        if (activityItems.size() > 8) {
            activityItems = activityItems.subList(0, 8);
        }

        StudentDetailResponse.StudentAnalyticsSummary analytics = new StudentDetailResponse.StudentAnalyticsSummary(
                courseSummaries.size(),
                totalCompletedCourses,
                totalInProgressCourses,
                totalLessonsCompleted,
                totalLearningMinutes,
                overallProgressPercent,
                totalQuizzesTaken,
                quizzesPassed,
                averageQuizScore,
                liveSessionsAttended,
                attendances.size()
        );

        return new StudentDetailResponse(
                student.getId(),
                student.getName(),
                student.getEmail(),
                student.getStatus().name(),
                student.getProfileImage(),
                student.isEmailVerified(),
                student.getCreatedAt(),
                student.getLastActiveAt(),
                courseSummaries.size(),
                analytics,
                courseSummaries,
                assessmentSummaries,
                attendanceSummaries,
                activityItems
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
            throw new BadRequestException("CANNOT_DISABLE_SUPER_ADMIN", "One Tutor admin accounts cannot be disabled");
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

package com.onetutor.admin.controller;

import com.onetutor.admin.dto.AdminDashboardStatsResponse;
import com.onetutor.audit.dto.AuditLogResponse;
import com.onetutor.audit.repository.AuditLogRepository;
import com.onetutor.common.ApiResponse;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.live.entity.LiveSessionStatus;
import com.onetutor.live.repository.LiveSessionRepository;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR', 'READONLY_ADMIN')")
@Transactional(readOnly = true)
public class AdminDashboardController {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final AuditLogRepository auditLogRepository;

    public AdminDashboardController(UserRepository userRepository,
                                    CourseRepository courseRepository,
                                    EnrollmentRepository enrollmentRepository,
                                    LiveSessionRepository liveSessionRepository,
                                    AuditLogRepository auditLogRepository) {
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.liveSessionRepository = liveSessionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    public ApiResponse<AdminDashboardStatsResponse> getStats() {
        long totalStudents = userRepository.countByRole(UserRole.student);
        long activeStudents = userRepository.countByRoleAndStatus(UserRole.student, UserStatus.active);
        long disabledStudents = userRepository.countByRoleAndStatus(UserRole.student, UserStatus.disabled);

        long totalCourses = courseRepository.count();
        long publishedCourses = courseRepository.countByStatus(CourseStatus.published);
        long draftCourses = courseRepository.countByStatus(CourseStatus.draft);
        long archivedCourses = courseRepository.countByStatus(CourseStatus.archived);

        long totalEnrollments = enrollmentRepository.count();
        long activeEnrollments = enrollmentRepository.countByStatus(EnrollmentStatus.active);

        Instant now = Instant.now();
        Instant startOfToday = LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant();
        long upcomingLiveSessions = liveSessionRepository.countUpcomingAndLive(now, startOfToday);

        var recentLogsPage = auditLogRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt")));

        List<AuditLogResponse> recentLogs = recentLogsPage.getContent().stream().map(log ->
                new AuditLogResponse(
                        log.getId(),
                        log.getUser() != null ? log.getUser().getId() : null,
                        log.getUser() != null ? log.getUser().getName() : "System",
                        log.getAction(),
                        log.getEntityType(),
                        log.getEntityId(),
                        log.getDetails(),
                        log.getCreatedAt()
                )
        ).toList();

        return ApiResponse.ok(new AdminDashboardStatsResponse(
                totalStudents,
                activeStudents,
                disabledStudents,
                totalCourses,
                publishedCourses,
                draftCourses,
                archivedCourses,
                totalEnrollments,
                activeEnrollments,
                upcomingLiveSessions,
                recentLogs
        ));
    }
}

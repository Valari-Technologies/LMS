package com.onetutor.enrollment;

import com.onetutor.audit.service.AuditService;
import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;
import com.onetutor.batches.repository.BatchRepository;
import com.onetutor.categories.entity.Category;
import com.onetutor.common.email.EmailService;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.dto.EnrollmentResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private BatchRepository batchRepository;

    @Mock
    private AuditService auditService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmailService emailService;

    private EnrollmentService enrollmentService;

    private User student;
    private Course course;

    @BeforeEach
    void setUp() {
        enrollmentService = new EnrollmentService(
                enrollmentRepository,
                courseRepository,
                batchRepository,
                auditService,
                notificationService,
                null,
                emailService,
                "http://localhost:5173"
        );

        student = new User();
        ReflectionTestUtils.setField(student, "id", 10L);
        student.setName("Alice Johnson");
        student.setEmail("alice@example.com");
        student.setRole(UserRole.student);

        Category category = new Category();
        category.setName("Web Development");

        course = new Course();
        ReflectionTestUtils.setField(course, "id", 100L);
        course.setName("Fullstack Spring & React Masterclass");
        course.setStatus(CourseStatus.published);
        course.setThumbnail("https://images.unsplash.com/photo-1516321318423-f06f85e504b3");
        course.setCategory(category);
    }

    @Test
    @DisplayName("Should send greetings email to student upon successful enrollment")
    void enroll_sendsGreetingEmail_onSuccess() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());
        when(batchRepository.findByCourseId(100L)).thenReturn(Collections.emptyList());
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment e = invocation.getArgument(0);
            ReflectionTestUtils.setField(e, "id", 1L);
            return e;
        });

        EnrollmentResponse response = enrollmentService.enroll(100L, student);

        assertNotNull(response);
        verify(emailService, times(1)).sendEnrollmentGreetingEmail(
                eq("alice@example.com"),
                eq("Alice Johnson"),
                eq("Fullstack Spring & React Masterclass"),
                eq("https://images.unsplash.com/photo-1516321318423-f06f85e504b3"),
                eq("Web Development"),
                isNull(),
                eq("http://localhost:5173/student/learn/100")
        );
    }

    @Test
    @DisplayName("Should succeed with enrollment even if greeting email dispatch throws exception")
    void enroll_succeeds_evenIfEmailFails() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());
        when(batchRepository.findByCourseId(100L)).thenReturn(Collections.emptyList());
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment e = invocation.getArgument(0);
            ReflectionTestUtils.setField(e, "id", 2L);
            return e;
        });

        doThrow(new RuntimeException("SMTP Server Unreachable"))
                .when(emailService).sendEnrollmentGreetingEmail(any(), any(), any(), any(), any(), any(), any());

        EnrollmentResponse response = assertDoesNotThrow(() -> enrollmentService.enroll(100L, student));
        assertNotNull(response);
    }

    @Test
    @DisplayName("Should include batch details in greeting email if batch enrollment")
    void enroll_withBatch_includesBatchInEmail() {
        Batch batch = new Batch();
        ReflectionTestUtils.setField(batch, "id", 50L);
        batch.setName("Summer 2026 Morning Cohort");
        batch.setStatus(BatchStatus.upcoming);
        batch.setCapacity(20);
        batch.setCourse(course);

        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());
        when(batchRepository.findByCourseId(100L)).thenReturn(List.of(batch));
        when(batchRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(batch));
        when(enrollmentRepository.countByBatchIdAndStatus(50L, EnrollmentStatus.active)).thenReturn(5L);
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment e = invocation.getArgument(0);
            ReflectionTestUtils.setField(e, "id", 3L);
            return e;
        });

        EnrollmentResponse response = enrollmentService.enroll(100L, 50L, student);

        assertNotNull(response);
        verify(emailService, times(1)).sendEnrollmentGreetingEmail(
                eq("alice@example.com"),
                eq("Alice Johnson"),
                eq("Fullstack Spring & React Masterclass"),
                eq("https://images.unsplash.com/photo-1516321318423-f06f85e504b3"),
                eq("Web Development"),
                eq("Summer 2026 Morning Cohort"),
                eq("http://localhost:5173/student/learn/100")
        );
    }

    @Test
    @DisplayName("Should block new enrollments when course status is draft")
    void enroll_whenCourseIsDraft_throwsBadRequest() {
        course.setStatus(CourseStatus.draft);
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));

        assertThrows(com.onetutor.common.exceptions.BadRequestException.class, () ->
                enrollmentService.enroll(100L, student));
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should block new enrollments when course status is archived")
    void enroll_whenCourseIsArchived_throwsBadRequest() {
        course.setStatus(CourseStatus.archived);
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));

        assertThrows(com.onetutor.common.exceptions.BadRequestException.class, () ->
                enrollmentService.enroll(100L, student));
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("assertActiveEnrollment should not auto-enroll when course is draft")
    void assertActiveEnrollment_whenCourseIsDraft_doesNotAutoEnroll() {
        course.setStatus(CourseStatus.draft);
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));

        assertThrows(com.onetutor.common.exceptions.ForbiddenException.class, () ->
                enrollmentService.assertActiveEnrollment(student, 100L));
        verify(enrollmentRepository, never()).save(any());
    }
}

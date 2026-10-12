package com.onetutor.courses;

import com.onetutor.audit.service.AuditService;
import com.onetutor.categories.service.CategoryService;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.contents.repository.ResourceRepository;
import com.onetutor.courses.dto.CourseDetailResponse;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.courses.service.CourseService;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseServiceAccessTest {

    @Mock private CourseRepository courseRepository;
    @Mock private SectionRepository sectionRepository;
    @Mock private ContentRepository contentRepository;
    @Mock private ResourceRepository resourceRepository;
    @Mock private CategoryService categoryService;
    @Mock private AuditService auditService;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    private CourseService courseService;
    private Course draftCourse;
    private Course archivedCourse;
    private Course publishedCourse;
    private User student;
    private User admin;

    @BeforeEach
    void setUp() {
        courseService = new CourseService(
                courseRepository,
                sectionRepository,
                contentRepository,
                resourceRepository,
                categoryService,
                auditService,
                enrollmentRepository,
                userRepository,
                notificationService,
                new ObjectMapper()
        );

        student = new User();
        ReflectionTestUtils.setField(student, "id", 10L);
        student.setRole(UserRole.student);

        admin = new User();
        ReflectionTestUtils.setField(admin, "id", 1L);
        admin.setRole(UserRole.admin);

        draftCourse = new Course();
        ReflectionTestUtils.setField(draftCourse, "id", 101L);
        draftCourse.setName("Draft Course");
        draftCourse.setStatus(CourseStatus.draft);

        archivedCourse = new Course();
        ReflectionTestUtils.setField(archivedCourse, "id", 102L);
        archivedCourse.setName("Archived Course");
        archivedCourse.setStatus(CourseStatus.archived);

        publishedCourse = new Course();
        ReflectionTestUtils.setField(publishedCourse, "id", 103L);
        publishedCourse.setName("Published Course");
        publishedCourse.setStatus(CourseStatus.published);
    }

    @Test
    @DisplayName("Enrolled student can view detail of a draft course")
    void enrolledStudent_canViewDraftCourse() {
        when(courseRepository.findById(101L)).thenReturn(Optional.of(draftCourse));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 101L, EnrollmentStatus.active))
                .thenReturn(Optional.of(new Enrollment()));

        CourseDetailResponse res = courseService.getDetail(101L, student);
        assertNotNull(res);
        assertEquals("Draft Course", res.name());
        assertEquals("draft", res.status());
    }

    @Test
    @DisplayName("Enrolled student can view detail of an archived course")
    void enrolledStudent_canViewArchivedCourse() {
        when(courseRepository.findById(102L)).thenReturn(Optional.of(archivedCourse));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 102L, EnrollmentStatus.active))
                .thenReturn(Optional.of(new Enrollment()));

        CourseDetailResponse res = courseService.getDetail(102L, student);
        assertNotNull(res);
        assertEquals("Archived Course", res.name());
        assertEquals("archived", res.status());
    }

    @Test
    @DisplayName("Non-enrolled student is blocked (NotFound) from draft course")
    void nonEnrolledStudent_cannotViewDraftCourse() {
        when(courseRepository.findById(101L)).thenReturn(Optional.of(draftCourse));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 101L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> courseService.getDetail(101L, student));
    }

    @Test
    @DisplayName("Unauthenticated visitor is blocked (NotFound) from draft course")
    void guest_cannotViewDraftCourse() {
        when(courseRepository.findById(101L)).thenReturn(Optional.of(draftCourse));

        assertThrows(NotFoundException.class, () -> courseService.getDetail(101L, null));
    }

    @Test
    @DisplayName("Admin can view draft and archived courses even if not enrolled")
    void admin_canViewDraftAndArchivedCourses() {
        when(courseRepository.findById(101L)).thenReturn(Optional.of(draftCourse));
        CourseDetailResponse res = courseService.getDetail(101L, admin);
        assertNotNull(res);
        assertEquals("Draft Course", res.name());
    }

    @Test
    @DisplayName("Anyone can view published course")
    void anyone_canViewPublishedCourse() {
        when(courseRepository.findById(103L)).thenReturn(Optional.of(publishedCourse));
        CourseDetailResponse res = courseService.getDetail(103L, null);
        assertNotNull(res);
        assertEquals("Published Course", res.name());
    }
}

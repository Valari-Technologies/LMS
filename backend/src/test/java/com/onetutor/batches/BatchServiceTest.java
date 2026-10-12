package com.onetutor.batches;

import com.onetutor.audit.service.AuditService;
import com.onetutor.batches.dto.BatchResponse;
import com.onetutor.batches.dto.CreateBatchRequest;
import com.onetutor.batches.dto.UpdateBatchRequest;
import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;
import com.onetutor.batches.repository.BatchRepository;
import com.onetutor.batches.service.BatchService;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.live.entity.LiveSession;
import com.onetutor.live.entity.LiveSessionStatus;
import com.onetutor.live.repository.LiveSessionRepository;
import com.onetutor.live.service.LiveMeetingProvider;
import com.onetutor.live.service.LiveSessionService;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BatchServiceTest {

    @Mock
    private BatchRepository batchRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private AuditService auditService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private com.onetutor.progress.service.ProgressService progressService;

    @Mock
    private LiveSessionRepository liveSessionRepository;

    @Mock
    private LiveMeetingProvider meetingProvider;

    private BatchService batchService;
    private EnrollmentService enrollmentService;
    private LiveSessionService liveSessionService;

    private User admin;
    private User student1;
    private User student2;
    private Course course;
    private Batch batchA;
    private Batch batchB;

    @BeforeEach
    void setUp() {
        batchService = new BatchService(batchRepository, courseRepository, enrollmentRepository, auditService, progressService, notificationService);
        enrollmentService = new EnrollmentService(enrollmentRepository, courseRepository, batchRepository,
                auditService, notificationService, null);
        liveSessionService = new LiveSessionService(liveSessionRepository, null, courseRepository,
                null, enrollmentRepository, null, meetingProvider, auditService, batchRepository, notificationService);

        admin = new User();
        ReflectionTestUtils.setField(admin, "id", 1L);
        admin.setName("Admin User");
        admin.setEmail("admin@onetutor.com");
        admin.setRole(UserRole.admin);

        student1 = new User();
        ReflectionTestUtils.setField(student1, "id", 10L);
        student1.setName("Student 1");
        student1.setEmail("student1@onetutor.com");
        student1.setRole(UserRole.student);

        student2 = new User();
        ReflectionTestUtils.setField(student2, "id", 20L);
        student2.setName("Student 2");
        student2.setEmail("student2@onetutor.com");
        student2.setRole(UserRole.student);

        course = new Course();
        ReflectionTestUtils.setField(course, "id", 100L);
        course.setName("Full Stack Java");
        course.setStatus(CourseStatus.published);

        batchA = new Batch();
        ReflectionTestUtils.setField(batchA, "id", 501L);
        batchA.setCourse(course);
        batchA.setName("Batch A");
        batchA.setCode("JAVA-B1");
        batchA.setCapacity(3);
        batchA.setStatus(BatchStatus.active);

        batchB = new Batch();
        ReflectionTestUtils.setField(batchB, "id", 502L);
        batchB.setCourse(course);
        batchB.setName("Batch B");
        batchB.setCode("JAVA-B2");
        batchB.setCapacity(2);
        batchB.setStatus(BatchStatus.active);
    }

    @Test
    void createBatch_success() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(batchRepository.existsByCourseIdAndCode(100L, "JAVA-B1")).thenReturn(false);
        when(batchRepository.save(any(Batch.class))).thenAnswer(inv -> {
            Batch b = inv.getArgument(0);
            ReflectionTestUtils.setField(b, "id", 501L);
            return b;
        });

        CreateBatchRequest req = new CreateBatchRequest(100L, "Batch A", "JAVA-B1", 30, BatchStatus.active,
                LocalDate.now(), LocalDate.now().plusMonths(3));

        BatchResponse resp = batchService.create(req, admin);

        assertNotNull(resp);
        assertEquals("Batch A", resp.name());
        assertEquals("JAVA-B1", resp.code());
        assertEquals(30, resp.capacity());
        assertEquals(30, resp.availableSeats());
        assertFalse(resp.isFull());
    }

    @Test
    void createBatch_duplicateCode_throwsConflict() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(batchRepository.existsByCourseIdAndCode(100L, "JAVA-B1")).thenReturn(true);

        CreateBatchRequest req = new CreateBatchRequest(100L, "Batch A", "JAVA-B1", 30, BatchStatus.active, null, null);

        assertThrows(ConflictException.class, () -> batchService.create(req, admin));
    }

    @Test
    void createBatch_invalidCapacity_throwsBadRequest() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));

        CreateBatchRequest req = new CreateBatchRequest(100L, "Batch A", "JAVA-B1", 0, BatchStatus.active, null, null);

        assertThrows(BadRequestException.class, () -> batchService.create(req, admin));
    }

    @Test
    void updateBatchCapacity_belowActiveEnrolled_throwsBadRequest() {
        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        // Current enrolled = 3, admin tries to reduce capacity to 2
        when(enrollmentRepository.countByBatchIdAndStatus(501L, EnrollmentStatus.active)).thenReturn(3L);

        UpdateBatchRequest req = new UpdateBatchRequest("Batch A", "JAVA-B1", 2, BatchStatus.active, null, null);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> batchService.update(501L, req, admin));
        assertTrue(ex.getMessage().contains("Cannot reduce batch capacity"));
    }

    @Test
    void updateBatchCapacity_aboveActiveEnrolled_succeeds() {
        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        when(enrollmentRepository.countByBatchIdAndStatus(501L, EnrollmentStatus.active)).thenReturn(2L);
        when(batchRepository.save(any(Batch.class))).thenReturn(batchA);

        UpdateBatchRequest req = new UpdateBatchRequest("Batch A", "JAVA-B1", 5, BatchStatus.active, null, null);

        BatchResponse resp = batchService.update(501L, req, admin);
        assertNotNull(resp);
        assertEquals(5, resp.capacity());
        assertEquals(3, resp.availableSeats());
    }

    @Test
    void enroll_batchFull_throwsConflict() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(batchRepository.findByCourseId(100L)).thenReturn(List.of(batchA));
        when(batchRepository.findByIdForUpdate(501L)).thenReturn(Optional.of(batchA));
        // Batch capacity is 3, currently active count is 3
        when(enrollmentRepository.countByBatchIdAndStatus(501L, EnrollmentStatus.active)).thenReturn(3L);

        ConflictException ex = assertThrows(ConflictException.class, () -> enrollmentService.enroll(100L, 501L, student1));
        assertTrue(ex.getMessage().contains("is full"));
    }

    @Test
    void enroll_seatsAvailable_succeeds() {
        when(courseRepository.findById(100L)).thenReturn(Optional.of(course));
        when(batchRepository.findByCourseId(100L)).thenReturn(List.of(batchA));
        when(batchRepository.findByIdForUpdate(501L)).thenReturn(Optional.of(batchA));
        // Capacity 3, currently 2 enrolled
        when(enrollmentRepository.countByBatchIdAndStatus(501L, EnrollmentStatus.active)).thenReturn(2L);
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.empty());

        var resp = enrollmentService.enroll(100L, 501L, student1);
        assertNotNull(resp);
        assertEquals("active", resp.status());
        assertEquals(501L, resp.batchId());
        assertEquals("Batch A", resp.batchName());
    }

    @Test
    void jitsiJoin_batchMismatch_throwsForbidden() {
        LiveSession session = new LiveSession();
        ReflectionTestUtils.setField(session, "id", 999L);
        session.setCourse(course);
        session.setBatch(batchA); // Session scheduled for Batch A
        session.setTitle("Live Workshop");
        session.setStatus(LiveSessionStatus.live);
        session.setMeetingUrl("https://meet.jit.si/test-room");

        // Student 2 is enrolled in Batch B, not Batch A
        Enrollment student2Enrollment = new Enrollment();
        student2Enrollment.setStudent(student2);
        student2Enrollment.setCourse(course);
        student2Enrollment.setBatch(batchB);
        student2Enrollment.setStatus(EnrollmentStatus.active);

        when(liveSessionRepository.findById(999L)).thenReturn(Optional.of(session));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(20L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.of(student2Enrollment));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> liveSessionService.getJoinInfo(999L, student2));
        assertEquals("BATCH_MISMATCH", ex.getCode());
        assertTrue(ex.getMessage().contains("Batch A"));
    }

    @Test
    void jitsiJoin_batchMatch_succeeds() {
        LiveSession session = new LiveSession();
        ReflectionTestUtils.setField(session, "id", 999L);
        session.setCourse(course);
        session.setBatch(batchA);
        session.setTitle("Live Workshop");
        session.setStatus(LiveSessionStatus.live);
        session.setMeetingUrl("https://meet.jit.si/test-room");

        // Student 1 is enrolled in Batch A
        Enrollment student1Enrollment = new Enrollment();
        student1Enrollment.setStudent(student1);
        student1Enrollment.setCourse(course);
        student1Enrollment.setBatch(batchA);
        student1Enrollment.setStatus(EnrollmentStatus.active);

        when(liveSessionRepository.findById(999L)).thenReturn(Optional.of(session));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndStatus(10L, 100L, EnrollmentStatus.active))
                .thenReturn(Optional.of(student1Enrollment));

        var joinInfo = liveSessionService.getJoinInfo(999L, student1);
        assertNotNull(joinInfo);
        assertEquals(999L, joinInfo.sessionId());
        assertEquals(501L, joinInfo.batchId());
        assertEquals("Batch A", joinInfo.batchName());
        assertFalse(joinInfo.isModerator());
    }

    @Test
    void listStudentUpcomingSessions_batchSpecific_onlyEnrolledBatchStudentReceives() {
        LiveSession sessionBatchA = new LiveSession();
        ReflectionTestUtils.setField(sessionBatchA, "id", 101L);
        sessionBatchA.setCourse(course);
        sessionBatchA.setBatch(batchA);
        sessionBatchA.setTitle("Batch A Exclusive Workshop");
        sessionBatchA.setStatus(LiveSessionStatus.upcoming);
        sessionBatchA.setMeetingUrl("https://meet.jit.si/batch-a-room");

        // Student 1 is enrolled in Batch A
        Enrollment student1Enrollment = new Enrollment();
        student1Enrollment.setStudent(student1);
        student1Enrollment.setCourse(course);
        student1Enrollment.setBatch(batchA);
        student1Enrollment.setStatus(EnrollmentStatus.active);

        // Student 2 is enrolled in Batch B
        Enrollment student2Enrollment = new Enrollment();
        student2Enrollment.setStudent(student2);
        student2Enrollment.setCourse(course);
        student2Enrollment.setBatch(batchB);
        student2Enrollment.setStatus(EnrollmentStatus.active);

        when(liveSessionRepository.findAllForStudent()).thenReturn(List.of(sessionBatchA));
        when(enrollmentRepository.findAllByStudentIdAndStatusWithCourse(10L, EnrollmentStatus.active))
                .thenReturn(List.of(student1Enrollment));
        when(enrollmentRepository.findAllByStudentIdAndStatusWithCourse(20L, EnrollmentStatus.active))
                .thenReturn(List.of(student2Enrollment));

        // Student 1 (in Batch A) MUST receive the session
        var student1Sessions = liveSessionService.listStudentUpcomingSessions(student1);
        assertEquals(1, student1Sessions.size());
        assertEquals("Batch A Exclusive Workshop", student1Sessions.get(0).title());
        assertTrue(student1Sessions.get(0).enrolled());

        // Student 2 (in Batch B) MUST NOT receive Batch A's session
        var student2Sessions = liveSessionService.listStudentUpcomingSessions(student2);
        assertEquals(0, student2Sessions.size());
    }

    @Test
    void listStudentUpcomingSessions_courseWide_allBatchesReceive() {
        LiveSession sessionCourseWide = new LiveSession();
        ReflectionTestUtils.setField(sessionCourseWide, "id", 102L);
        sessionCourseWide.setCourse(course);
        sessionCourseWide.setBatch(null); // Course only (all batches)
        sessionCourseWide.setTitle("Course-Wide Live Q&A");
        sessionCourseWide.setStatus(LiveSessionStatus.upcoming);
        sessionCourseWide.setMeetingUrl("https://meet.jit.si/course-room");

        Enrollment student1Enrollment = new Enrollment();
        student1Enrollment.setStudent(student1);
        student1Enrollment.setCourse(course);
        student1Enrollment.setBatch(batchA);
        student1Enrollment.setStatus(EnrollmentStatus.active);

        Enrollment student2Enrollment = new Enrollment();
        student2Enrollment.setStudent(student2);
        student2Enrollment.setCourse(course);
        student2Enrollment.setBatch(batchB);
        student2Enrollment.setStatus(EnrollmentStatus.active);

        when(liveSessionRepository.findAllForStudent()).thenReturn(List.of(sessionCourseWide));
        when(enrollmentRepository.findAllByStudentIdAndStatusWithCourse(10L, EnrollmentStatus.active))
                .thenReturn(List.of(student1Enrollment));
        when(enrollmentRepository.findAllByStudentIdAndStatusWithCourse(20L, EnrollmentStatus.active))
                .thenReturn(List.of(student2Enrollment));

        // Both batches receive course-wide session
        var student1Sessions = liveSessionService.listStudentUpcomingSessions(student1);
        assertEquals(1, student1Sessions.size());
        assertTrue(student1Sessions.get(0).enrolled());

        var student2Sessions = liveSessionService.listStudentUpcomingSessions(student2);
        assertEquals(1, student2Sessions.size());
        assertTrue(student2Sessions.get(0).enrolled());
    }

    @Test
    void removeStudentFromBatch_success() {
        Enrollment enrollment = new Enrollment();
        ReflectionTestUtils.setField(enrollment, "id", 77L);
        enrollment.setStudent(student1);
        enrollment.setCourse(course);
        enrollment.setBatch(batchA);
        enrollment.setStatus(EnrollmentStatus.active);

        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        when(enrollmentRepository.findById(77L)).thenReturn(Optional.of(enrollment));

        batchService.removeStudentFromBatch(501L, 77L, admin);

        assertEquals(EnrollmentStatus.removed, enrollment.getStatus());
        assertNotNull(enrollment.getRemovedAt());
        verify(enrollmentRepository).save(enrollment);
        verify(auditService).log(eq(admin), eq("REMOVE_STUDENT_FROM_BATCH"), eq("Batch"), eq(501L), anyString());
    }

    @Test
    void removeStudentFromBatch_batchMismatch_throwsBadRequest() {
        Enrollment enrollment = new Enrollment();
        ReflectionTestUtils.setField(enrollment, "id", 77L);
        enrollment.setStudent(student1);
        enrollment.setCourse(course);
        enrollment.setBatch(batchB); // Enrolled in Batch B, not Batch A
        enrollment.setStatus(EnrollmentStatus.active);

        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        when(enrollmentRepository.findById(77L)).thenReturn(Optional.of(enrollment));

        assertThrows(BadRequestException.class, () ->
                batchService.removeStudentFromBatch(501L, 77L, admin));
    }

    @Test
    void changeStudentBatch_success() {
        Enrollment enrollment = new Enrollment();
        ReflectionTestUtils.setField(enrollment, "id", 77L);
        enrollment.setStudent(student1);
        enrollment.setCourse(course);
        enrollment.setBatch(batchA);
        enrollment.setStatus(EnrollmentStatus.active);

        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        when(batchRepository.findById(502L)).thenReturn(Optional.of(batchB));
        when(enrollmentRepository.findById(77L)).thenReturn(Optional.of(enrollment));
        when(enrollmentRepository.countByBatchIdAndStatus(502L, EnrollmentStatus.active)).thenReturn(1L); // capacity is 2

        batchService.changeStudentBatch(501L, 77L, 502L, admin);

        assertEquals(batchB, enrollment.getBatch());
        verify(enrollmentRepository).save(enrollment);
        verify(auditService).log(eq(admin), eq("CHANGE_STUDENT_BATCH"), eq("Batch"), eq(502L), anyString());
    }

    @Test
    void changeStudentBatch_targetBatchFull_throwsConflict() {
        Enrollment enrollment = new Enrollment();
        ReflectionTestUtils.setField(enrollment, "id", 77L);
        enrollment.setStudent(student1);
        enrollment.setCourse(course);
        enrollment.setBatch(batchA);
        enrollment.setStatus(EnrollmentStatus.active);

        when(batchRepository.findById(501L)).thenReturn(Optional.of(batchA));
        when(batchRepository.findById(502L)).thenReturn(Optional.of(batchB));
        when(enrollmentRepository.findById(77L)).thenReturn(Optional.of(enrollment));
        when(enrollmentRepository.countByBatchIdAndStatus(502L, EnrollmentStatus.active)).thenReturn(2L); // capacity is 2, full!

        assertThrows(ConflictException.class, () ->
                batchService.changeStudentBatch(501L, 77L, 502L, admin));
    }

    @Test
    void changeStudentBatch_sameBatch_throwsBadRequest() {
        assertThrows(BadRequestException.class, () ->
                batchService.changeStudentBatch(501L, 77L, 501L, admin));
    }
}

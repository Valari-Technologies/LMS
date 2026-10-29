package com.onetutor.live.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.common.exceptions.UnauthorizedException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.live.dto.*;
import com.onetutor.live.entity.LiveSession;
import com.onetutor.live.entity.LiveSessionStatus;
import com.onetutor.live.entity.SessionRecording;
import com.onetutor.live.repository.LiveSessionRepository;
import com.onetutor.live.repository.SessionRecordingRepository;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

@Service
@Transactional
public class LiveSessionService {

    private static final Logger log = LoggerFactory.getLogger(LiveSessionService.class);

    private final LiveSessionRepository liveSessionRepository;
    private final SessionRecordingRepository sessionRecordingRepository;
    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final com.onetutor.media.repository.MediaAssetRepository mediaAssetRepository;
    private final LiveMeetingProvider meetingProvider;
    private final AuditService auditService;
    private final com.onetutor.batches.repository.BatchRepository batchRepository;
    private final com.onetutor.notifications.service.NotificationService notificationService;
    private final com.onetutor.subtitles.service.SubtitleService subtitleService;

    public LiveSessionService(LiveSessionRepository liveSessionRepository,
                              SessionRecordingRepository sessionRecordingRepository,
                              CourseRepository courseRepository,
                              SectionRepository sectionRepository,
                              EnrollmentRepository enrollmentRepository,
                              com.onetutor.media.repository.MediaAssetRepository mediaAssetRepository,
                              LiveMeetingProvider meetingProvider,
                              AuditService auditService,
                              com.onetutor.batches.repository.BatchRepository batchRepository,
                              com.onetutor.notifications.service.NotificationService notificationService,
                              @org.springframework.context.annotation.Lazy com.onetutor.subtitles.service.SubtitleService subtitleService) {
        this.liveSessionRepository = liveSessionRepository;
        this.sessionRecordingRepository = sessionRecordingRepository;
        this.courseRepository = courseRepository;
        this.sectionRepository = sectionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.meetingProvider = meetingProvider;
        this.auditService = auditService;
        this.batchRepository = batchRepository;
        this.notificationService = notificationService;
        this.subtitleService = subtitleService;
    }

    @Transactional
    public LiveSessionResponse create(CreateLiveSessionRequest req, User actor) {
        Course course = courseRepository.findById(req.courseId())
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        LiveSession session = new LiveSession();
        session.setCourse(course);
        if (req.batchId() != null) {
            com.onetutor.batches.entity.Batch batch = batchRepository.findById(req.batchId())
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + req.batchId()));
            if (!batch.getCourse().getId().equals(course.getId())) {
                throw new BadRequestException("INVALID_BATCH_COURSE", "Selected batch does not belong to the course");
            }
            session.setBatch(batch);
        }
        if (req.sectionId() != null) {
            var section = sectionRepository.findById(req.sectionId())
                    .orElseThrow(() -> new NotFoundException("SECTION_NOT_FOUND", "Section not found"));
            session.setSection(section);
        }
        session.setTitle(req.title().trim());
        session.setDescription(req.description());
        session.setScheduledAt(req.scheduledAt());
        session.setEndTime(req.endTime());

        String meetingUrl = req.meetingUrl() != null ? req.meetingUrl().trim() : "";
        if (meetingUrl.isBlank()) {
            String randomCode = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            meetingUrl = "https://meet.jit.si/OneTutor-Course" + course.getId() + "-" + randomCode;
        } else if (!meetingUrl.startsWith("http://") && !meetingUrl.startsWith("https://")) {
            meetingUrl = "https://meet.jit.si/" + meetingUrl;
        }
        session.setMeetingUrl(meetingUrl);

        session.setStatus(LiveSessionStatus.upcoming);

        liveSessionRepository.save(session);

        auditService.log(actor, "CREATE_LIVE_SESSION", "LiveSession", session.getId(),
                "Scheduled live session: " + session.getTitle() + " for course " + course.getName() +
                (session.getBatch() != null ? " (" + session.getBatch().getName() + ")" : ""));

        // Notify enrolled students of upcoming live session
        try {
            List<User> students = session.getBatch() != null
                    ? enrollmentRepository.findActiveStudentsByBatchId(session.getBatch().getId())
                    : enrollmentRepository.findActiveStudentsByCourseId(course.getId());
            if (students != null && !students.isEmpty()) {
                String title = "Upcoming Live Class: " + session.getTitle();
                String body = "A new live class for '" + course.getName() + "' is scheduled. Check your live schedule!";
                String linkUrl = "/student/live-classes";
                notificationService.notifyUsers(students, title, body,
                        com.onetutor.notifications.entity.NotificationType.LIVE_CLASS,
                        course.getThumbnail(), linkUrl);
            }
        } catch (Exception e) {
            // Log and ignore to prevent failing live session creation
        }

        return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
    }

    @Transactional
    public LiveSessionResponse update(Long id, UpdateLiveSessionRequest req, User actor) {
        LiveSession session = liveSessionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));

        LiveSessionStatus oldStatus = session.getStatus();

        if (req.courseId() != null) {
            Course course = courseRepository.findById(req.courseId())
                    .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));
            session.setCourse(course);
        }
        if (req.batchId() != null) {
            com.onetutor.batches.entity.Batch batch = batchRepository.findById(req.batchId())
                    .orElseThrow(() -> new NotFoundException("BATCH_NOT_FOUND", "Batch not found with ID: " + req.batchId()));
            if (!batch.getCourse().getId().equals(session.getCourse().getId())) {
                throw new BadRequestException("INVALID_BATCH_COURSE", "Selected batch does not belong to the session course");
            }
            session.setBatch(batch);
        } else {
            session.setBatch(null);
        }
        if (req.title() != null && !req.title().isBlank()) session.setTitle(req.title().trim());
        if (req.description() != null) session.setDescription(req.description());
        if (req.scheduledAt() != null) session.setScheduledAt(req.scheduledAt());
        if (req.meetingUrl() != null) {
            String meetingUrl = req.meetingUrl().trim();
            if (!meetingUrl.isBlank() && !meetingUrl.startsWith("http://") && !meetingUrl.startsWith("https://")) {
                meetingUrl = "https://meet.jit.si/" + meetingUrl;
            }
            session.setMeetingUrl(meetingUrl);
        }

        if (req.status() != null && !req.status().isBlank()) {
            try {
                session.setStatus(LiveSessionStatus.valueOf(req.status().toLowerCase()));
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("INVALID_STATUS", "Invalid live session status: " + req.status());
            }
        }


        // If scheduled time is in the future, it must be 'upcoming' unless explicitly cancelled or completed
        if (session.getScheduledAt() != null && session.getScheduledAt().isAfter(Instant.now())) {
            if (session.getStatus() == LiveSessionStatus.live) {
                session.setStatus(LiveSessionStatus.upcoming);
            }
        }

        liveSessionRepository.save(session);
        auditService.log(actor, "UPDATE_LIVE_SESSION", "LiveSession", session.getId(),
                "Updated live session: " + session.getTitle());

        // Notify enrolled students when class starts live
        if (session.getStatus() == LiveSessionStatus.live && oldStatus != LiveSessionStatus.live) {
            try {
                List<User> students = session.getBatch() != null
                        ? enrollmentRepository.findActiveStudentsByBatchId(session.getBatch().getId())
                        : enrollmentRepository.findActiveStudentsByCourseId(session.getCourse().getId());
                if (students != null && !students.isEmpty()) {
                    String title = "Live Class Started: " + session.getTitle();
                    String body = "The live class for '" + session.getCourse().getName() + "' is now live! Join the classroom now.";
                    String linkUrl = "/student/live-classroom/" + session.getId();
                    String coverImage = session.getCourse() != null ? session.getCourse().getThumbnail() : null;
                    notificationService.notifyUsers(students, title, body,
                            com.onetutor.notifications.entity.NotificationType.LIVE_CLASS, coverImage, linkUrl);
                }
            } catch (Exception e) {
                // ignore
            }
        }

        return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
    }

    @Transactional
    public LiveSessionResponse cancel(Long id, User actor) {
        LiveSession session = liveSessionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));

        session.setStatus(LiveSessionStatus.cancelled);
        liveSessionRepository.save(session);
        auditService.log(actor, "CANCEL_LIVE_SESSION", "LiveSession", session.getId(),
                "Cancelled live session: " + session.getTitle());

        return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
    }

    @Transactional
    public SessionRecordingResponse attachRecording(Long id, AttachRecordingRequest req, User actor) {
        LiveSession session = liveSessionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));

        SessionRecording recording = new SessionRecording();
        recording.setSession(session);

        if (req.mediaAssetId() != null) {
            com.onetutor.media.entity.MediaAsset asset = mediaAssetRepository.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
            recording.setMediaAsset(asset);
            if (req.url() == null || req.url().isBlank()) {
                recording.setUrl("/api/v1/media/files/" + asset.getId());
            }
        }
        if (req.url() != null && !req.url().isBlank()) {
            recording.setUrl(req.url().trim());
        } else if (recording.getUrl() == null) {
            throw new BadRequestException("INVALID_RECORDING", "Either url or mediaAssetId must be provided");
        }

        recording.setDuration(req.duration());
        sessionRecordingRepository.save(recording);

        if (session.getStatus() == LiveSessionStatus.live || session.getStatus() == LiveSessionStatus.upcoming) {
            session.setStatus(LiveSessionStatus.completed);
            liveSessionRepository.save(session);
        }

        // Automatically trigger English subtitle generation for this recording
        try {
            if (subtitleService != null) {
                subtitleService.processSessionRecordingSubtitlesAsync(recording.getId());
            }
        } catch (Exception e) {
            log.warn("[LiveSessionService] Failed to auto-trigger subtitles for recording #{}: {}", recording.getId(), e.getMessage());
        }

        auditService.log(actor, "ATTACH_RECORDING", "LiveSession", session.getId(),
                "Attached recording to live session: " + session.getTitle());

        return SessionRecordingResponse.from(recording);
    }

    @Transactional
    public SessionRecordingResponse updateRecording(Long sessionId, Long recordingId, AttachRecordingRequest req, User actor) {
        LiveSession session = liveSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));
        SessionRecording recording = sessionRecordingRepository.findById(recordingId)
                .orElseThrow(() -> new NotFoundException("RECORDING_NOT_FOUND", "Recording not found"));
        if (!recording.getSession().getId().equals(session.getId())) {
            throw new BadRequestException("INVALID_RECORDING", "Recording does not belong to this session");
        }

        boolean urlChanged = false;
        if (req.mediaAssetId() != null) {
            com.onetutor.media.entity.MediaAsset asset = mediaAssetRepository.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
            recording.setMediaAsset(asset);
            if (req.url() == null || req.url().isBlank()) {
                String newUrl = "/api/v1/media/files/" + asset.getId();
                if (!newUrl.equals(recording.getUrl())) {
                    recording.setUrl(newUrl);
                    urlChanged = true;
                }
            }
        }
        if (req.url() != null && !req.url().isBlank()) {
            String newUrl = req.url().trim();
            if (!newUrl.equals(recording.getUrl())) {
                recording.setUrl(newUrl);
                urlChanged = true;
            }
        }

        if (req.duration() != null) {
            recording.setDuration(req.duration());
        }

        sessionRecordingRepository.save(recording);

        if (urlChanged) {
            try {
                if (subtitleService != null) {
                    subtitleService.processSessionRecordingSubtitlesAsync(recording.getId());
                }
            } catch (Exception e) {
                log.warn("[LiveSessionService] Failed to trigger subtitles on updated recording #{}: {}", recording.getId(), e.getMessage());
            }
        }

        auditService.log(actor, "UPDATE_RECORDING", "LiveSession", session.getId(),
                "Updated recording on live session: " + session.getTitle());

        return SessionRecordingResponse.from(recording);
    }

    @Transactional
    public SessionRecordingResponse generateRecordingSubtitles(Long sessionId, Long recordingId, User actor) {
        SessionRecording recording = sessionRecordingRepository.findById(recordingId)
                .orElseThrow(() -> new NotFoundException("RECORDING_NOT_FOUND", "Recording not found"));
        if (subtitleService != null) {
            subtitleService.triggerSessionRecordingSubtitles(recording.getId());
        }
        return SessionRecordingResponse.from(recording);
    }

    @Transactional
    public void deleteRecording(Long sessionId, Long recordingId, User actor) {
        LiveSession session = liveSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));
        SessionRecording recording = sessionRecordingRepository.findById(recordingId)
                .orElseThrow(() -> new NotFoundException("RECORDING_NOT_FOUND", "Recording not found"));
        if (!recording.getSession().getId().equals(session.getId())) {
            throw new BadRequestException("INVALID_RECORDING", "Recording does not belong to this session");
        }
        sessionRecordingRepository.delete(recording);
        auditService.log(actor, "DELETE_RECORDING", "LiveSession", session.getId(),
                "Deleted recording from live session: " + session.getTitle());
    }

    @Transactional
    public LiveSessionResponse complete(Long id, User actor) {
        LiveSession session = liveSessionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));

        if (session.getStatus() == LiveSessionStatus.cancelled) {
            throw new BadRequestException("SESSION_CANCELLED", "Cannot complete a cancelled session");
        }
        if (session.getStatus() == LiveSessionStatus.completed) {
            // Already completed — return existing session idempotently
            return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
        }

        session.setStatus(LiveSessionStatus.completed);
        liveSessionRepository.save(session);
        auditService.log(actor, "COMPLETE_LIVE_SESSION", "LiveSession", session.getId(),
                "Manually completed live session: " + session.getTitle());

        return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
    }

    /** Returns the start of today (midnight) for use in auto-complete threshold. */
    public Instant startOfToday() {
        return LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    @Transactional
    public long getUpcomingAndLiveCount() {
        Instant now = Instant.now();
        Instant startOfToday = startOfToday();
        try {
            liveSessionRepository.markCompletedSessions(now, startOfToday);
            liveSessionRepository.revertFutureLiveSessions(now);
            liveSessionRepository.markLiveSessions(now);
        } catch (Exception ignored) {}
        return liveSessionRepository.countUpcomingAndLive(now, startOfToday);
    }

    @Transactional
    public PageResponse<LiveSessionResponse> adminList(Long courseId, String statusStr, Pageable pageable) {
        try {
            Instant now = Instant.now();
            liveSessionRepository.markCompletedSessions(now, startOfToday());
            liveSessionRepository.revertFutureLiveSessions(now);
            liveSessionRepository.markLiveSessions(now);
        } catch (Exception ignored) {}

        LiveSessionStatus status = null;
        if (statusStr != null && !statusStr.isBlank() && !statusStr.equalsIgnoreCase("ALL")) {
            try {
                status = LiveSessionStatus.valueOf(statusStr.toLowerCase());
            } catch (IllegalArgumentException ignored) {}
        }
        Page<LiveSession> page = liveSessionRepository.filterSessions(courseId, status, pageable);
        return PageResponse.from(page.map(s -> LiveSessionResponse.from(s, meetingProvider.getJoinUrl(s.getMeetingUrl()))));
    }

    @Transactional
    public List<LiveSessionResponse> listStudentUpcomingSessions(User student) {
        try {
            Instant now = Instant.now();
            liveSessionRepository.markCompletedSessions(now, startOfToday());
            liveSessionRepository.revertFutureLiveSessions(now);
            liveSessionRepository.markLiveSessions(now);
        } catch (Exception ignored) {}

        java.util.Set<Long> enrolledCourseIds = new java.util.HashSet<>();
        java.util.Map<Long, Long> studentCourseBatchMap = new java.util.HashMap<>();

        if (student != null) {
            List<Enrollment> enrollments = enrollmentRepository.findAllByStudentIdAndStatusWithCourse(student.getId(), EnrollmentStatus.active);
            for (Enrollment e : enrollments) {
                enrolledCourseIds.add(e.getCourse().getId());
                if (e.getBatch() != null) {
                    studentCourseBatchMap.put(e.getCourse().getId(), e.getBatch().getId());
                }
            }
        }

        List<LiveSession> sessions = liveSessionRepository.findAllForStudent();
        return sessions.stream()
                .filter(s -> {
                    boolean courseEnrolled = enrolledCourseIds.contains(s.getCourse().getId());
                    if (s.getBatch() != null) {
                        // Live class is scheduled specifically for s.getBatch():
                        // "if i select certain batch the live class only for that batch other batch can't recieve that live class details in their webspage"
                        if (!courseEnrolled) {
                            return false;
                        }
                        Long studentBatchId = studentCourseBatchMap.get(s.getCourse().getId());
                        return studentBatchId != null && studentBatchId.equals(s.getBatch().getId());
                    } else {
                        // Live class is scheduled for Course only (no batch selected):
                        // "if i select course only then it will be for all batch"
                        // All students enrolled in any batch of this course receive it.
                        return true;
                    }
                })
                .map(s -> {
                    boolean courseEnrolled = enrolledCourseIds.contains(s.getCourse().getId());
                    boolean canJoin = (s.getBatch() == null) ? courseEnrolled : true;
                    return LiveSessionResponse.from(
                            s,
                            meetingProvider.getJoinUrl(s.getMeetingUrl()),
                            canJoin
                    );
                })
                .toList();
    }

    @Transactional
    public LiveSessionResponse getSession(Long id) {
        try {
            Instant now = Instant.now();
            liveSessionRepository.markCompletedSessions(now, startOfToday());
            liveSessionRepository.revertFutureLiveSessions(now);
            liveSessionRepository.markLiveSessions(now);
        } catch (Exception ignored) {}

        LiveSession session = liveSessionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));
        return LiveSessionResponse.from(session, meetingProvider.getJoinUrl(session.getMeetingUrl()));
    }

    @Transactional
    public LiveClassroomJoinInfo getJoinInfo(Long sessionId, User actor) {
        if (actor == null) {
            throw new UnauthorizedException("UNAUTHORIZED", "Authentication required to join live classroom");
        }

        try {
            Instant now = Instant.now();
            liveSessionRepository.markCompletedSessions(now, startOfToday());
            liveSessionRepository.revertFutureLiveSessions(now);
            liveSessionRepository.markLiveSessions(now);
        } catch (Exception ignored) {}

        LiveSession session = liveSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("SESSION_NOT_FOUND", "Live session not found"));

        boolean isAdmin = actor.getRole() == com.onetutor.users.entity.UserRole.admin || actor.getRole() == com.onetutor.users.entity.UserRole.super_admin;

        if (!isAdmin) {
            Enrollment enrollment = enrollmentRepository.findByStudentIdAndCourseIdAndStatus(
                    actor.getId(),
                    session.getCourse().getId(),
                    EnrollmentStatus.active
            ).orElseThrow(() -> new ForbiddenException("ENROLLMENT_REQUIRED",
                    "Access restricted. You must be actively enrolled in " + session.getCourse().getName() + " to join this live classroom."));

            if (session.getBatch() != null) {
                if (enrollment.getBatch() == null || !enrollment.getBatch().getId().equals(session.getBatch().getId())) {
                    String enrolledBatchName = enrollment.getBatch() != null ? enrollment.getBatch().getName() : "another batch";
                    throw new ForbiddenException("BATCH_MISMATCH",
                            "Access restricted. This live session is scheduled exclusively for " + session.getBatch().getName() +
                            ". You are enrolled in " + enrolledBatchName + ".");
                }
            }
        }

        String meetingUrl = session.getMeetingUrl();
        if (meetingUrl == null || meetingUrl.isBlank()) {
            String generatedRoom = "OneTutor-Course" + session.getCourse().getId() + "-" + session.getId();
            meetingUrl = "https://meet.jit.si/" + generatedRoom;
            session.setMeetingUrl(meetingUrl);
            liveSessionRepository.save(session);
        }

        String domain = "meet.jit.si";
        String roomName = "OneTutor-Course" + session.getCourse().getId() + "-" + session.getId();

        try {
            String cleanUrl = meetingUrl.trim();
            if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
                cleanUrl = "https://" + cleanUrl;
            }
            java.net.URI uri = java.net.URI.create(cleanUrl);
            if (uri.getHost() != null && !uri.getHost().isBlank()) {
                domain = uri.getHost();
            }
            String path = uri.getPath();
            if (path != null && path.length() > 1) {
                roomName = path.startsWith("/") ? path.substring(1) : path;
            }
        } catch (Exception ignored) {}

        return new LiveClassroomJoinInfo(
                session.getId(),
                session.getCourse().getId(),
                session.getCourse().getName(),
                session.getBatch() != null ? session.getBatch().getId() : null,
                session.getBatch() != null ? session.getBatch().getName() : null,
                session.getTitle(),
                session.getDescription(),
                session.getScheduledAt(),
                session.getEndTime(),
                meetingUrl,
                roomName,
                domain,
                actor.getName() != null ? actor.getName() : "OneTutor User",
                actor.getEmail() != null ? actor.getEmail() : "",
                isAdmin,
                session.getStatus().name()
        );
    }
}


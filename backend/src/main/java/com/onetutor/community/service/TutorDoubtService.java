package com.onetutor.community.service;

import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.community.dto.SendDoubtMessageRequest;
import com.onetutor.community.dto.TutorDoubtMessageResponse;
import com.onetutor.community.dto.TutorDoubtThreadResponse;
import com.onetutor.community.entity.MessageType;
import com.onetutor.community.entity.TutorDoubtMessage;
import com.onetutor.community.entity.TutorDoubtReadStatus;
import com.onetutor.community.repository.TutorDoubtMessageRepository;
import com.onetutor.community.repository.TutorDoubtReadStatusRepository;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.media.repository.MediaAssetRepository;
import com.onetutor.notifications.entity.NotificationType;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class TutorDoubtService {

    private final TutorDoubtMessageRepository doubtMessageRepo;
    private final TutorDoubtReadStatusRepository doubtReadRepo;
    private final CourseRepository courseRepo;
    private final EnrollmentRepository enrollmentRepo;
    private final UserRepository userRepo;
    private final MediaAssetRepository mediaAssetRepo;
    private final NotificationService notificationService;

    public TutorDoubtService(TutorDoubtMessageRepository doubtMessageRepo,
                             TutorDoubtReadStatusRepository doubtReadRepo,
                             CourseRepository courseRepo,
                             EnrollmentRepository enrollmentRepo,
                             UserRepository userRepo,
                             MediaAssetRepository mediaAssetRepo,
                             NotificationService notificationService) {
        this.doubtMessageRepo = doubtMessageRepo;
        this.doubtReadRepo = doubtReadRepo;
        this.courseRepo = courseRepo;
        this.enrollmentRepo = enrollmentRepo;
        this.userRepo = userRepo;
        this.mediaAssetRepo = mediaAssetRepo;
        this.notificationService = notificationService;
    }

    // ── Student Methods ──────────────────────────────────────────────────────────

    /** Get paginated 1-on-1 doubt messages for the student in this course. */
    @Transactional
    public PageResponse<TutorDoubtMessageResponse> getStudentDoubtMessages(
            Long courseId, Pageable pageable, User student) {
        assertStudentEnrolled(courseId, student);

        Page<TutorDoubtMessage> page = doubtMessageRepo
                .findByCourseIdAndStudentIdOrderByCreatedAtAsc(courseId, student.getId(), pageable);

        if (page.hasContent()) {
            Long maxId = page.getContent().get(page.getContent().size() - 1).getId();
            markReadInternal(courseId, student.getId(), student.getId(), maxId);
        } else {
            markReadInternal(courseId, student.getId(), student.getId(), null);
        }

        return PageResponse.from(page.map(TutorDoubtMessageResponse::from));
    }

    /** Poll new doubt messages for student. */
    @Transactional(readOnly = true)
    public List<TutorDoubtMessageResponse> pollStudentDoubtMessages(
            Long courseId, Long afterId, User student) {
        assertStudentEnrolled(courseId, student);

        return doubtMessageRepo
                .findByCourseIdAndStudentIdAndIdGreaterThanOrderByCreatedAtAsc(courseId, student.getId(), afterId)
                .stream()
                .map(TutorDoubtMessageResponse::from)
                .toList();
    }

    /** Student sends a new doubt message to the course tutors. */
    @Transactional
    public TutorDoubtMessageResponse sendStudentDoubtMessage(
            Long courseId, SendDoubtMessageRequest req, User student) {
        assertStudentEnrolled(courseId, student);

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        boolean hasContent = req.content() != null && !req.content().isBlank();
        boolean hasMedia   = req.mediaAssetId() != null;
        if (!hasContent && !hasMedia) {
            throw new BadRequestException("INVALID_MESSAGE", "Doubt message must contain text or an attachment");
        }

        MessageType type = parseMessageType(req.messageType());

        TutorDoubtMessage msg = new TutorDoubtMessage();
        msg.setCourse(course);
        msg.setStudent(student);
        msg.setSender(student);
        msg.setContent(hasContent ? req.content().trim() : null);
        msg.setMessageType(type);

        if (hasMedia) {
            MediaAsset asset = mediaAssetRepo.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media attachment not found"));
            msg.setMediaAsset(asset);
        }

        TutorDoubtMessage saved = doubtMessageRepo.save(msg);
        markReadInternal(courseId, student.getId(), student.getId(), saved.getId());

        // Notify instructors and course creators of new doubt
        try {
            List<User> tutors = getCourseTutors(course);
            if (!tutors.isEmpty()) {
                String preview = hasContent ? req.content().trim() : "Sent an attachment";
                if (preview.length() > 70) preview = preview.substring(0, 67) + "...";
                String title = "New Student Doubt: " + course.getName();
                String body = student.getName() + " asked: " + preview;
                String linkUrl = "/admin/doubts?courseId=" + courseId + "&studentId=" + student.getId();

                notificationService.notifyUsers(tutors, title, body,
                        NotificationType.COMMUNITY, course.getThumbnail(), linkUrl);
            }
        } catch (Exception ignored) {}

        return TutorDoubtMessageResponse.from(saved);
    }

    /** Mark student doubt thread as read by student. */
    @Transactional
    public void markStudentDoubtRead(Long courseId, Long messageId, User student) {
        markReadInternal(courseId, student.getId(), student.getId(), messageId);
    }

    // ── Tutor / Admin Methods ───────────────────────────────────────────────────

    /** Tutor overview: list all student doubt threads for this course. */
    @Transactional(readOnly = true)
    public List<TutorDoubtThreadResponse> getCourseDoubtThreads(Long courseId, User tutor) {
        assertTutorOrAdmin(courseId, tutor);

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        List<Long> studentIds = doubtMessageRepo.findDistinctStudentIdsByCourseId(courseId);
        if (studentIds.isEmpty()) return Collections.emptyList();

        List<TutorDoubtThreadResponse> threads = new ArrayList<>();
        for (Long studentId : studentIds) {
            Optional<User> studentOpt = userRepo.findById(studentId);
            if (studentOpt.isEmpty()) continue;
            User student = studentOpt.get();

            Optional<TutorDoubtMessage> lastMsgOpt = doubtMessageRepo
                    .findFirstByCourseIdAndStudentIdOrderByCreatedAtDesc(courseId, studentId);
            if (lastMsgOpt.isEmpty()) continue;
            TutorDoubtMessage lastMsg = lastMsgOpt.get();

            Optional<TutorDoubtReadStatus> readOpt = doubtReadRepo
                    .findByUserIdAndCourseIdAndStudentId(tutor.getId(), courseId, studentId);
            Long lastReadId = readOpt.map(TutorDoubtReadStatus::getLastReadMessageId).orElse(0L);

            long unread = doubtMessageRepo.countUnreadMessages(courseId, studentId, lastReadId, tutor.getId());

            boolean isWaiting = lastMsg.getSender().getId().equals(studentId);
            String status = isWaiting ? "waiting_for_tutor" : "answered";

            threads.add(new TutorDoubtThreadResponse(
                    student.getId(),
                    student.getName(),
                    student.getEmail(),
                    student.getProfileImage(),
                    course.getId(),
                    course.getName(),
                    lastMsg.getContent() != null ? lastMsg.getContent() :
                            (lastMsg.getMessageType() == MessageType.image ? "📷 Photo" :
                             lastMsg.getMessageType() == MessageType.video ? "🎥 Video" : "📄 Attachment"),
                    lastMsg.getMessageType().name(),
                    lastMsg.getSender().getRole().name(),
                    lastMsg.getCreatedAt(),
                    unread,
                    status
            ));
        }

        // Sort threads by most recent message descending
        threads.sort((a, b) -> b.lastMessageTime().compareTo(a.lastMessageTime()));
        return threads;
    }

    /** Admin / Tutor: list all doubt threads across ALL courses (or filtered by courseId). */
    @Transactional(readOnly = true)
    public List<TutorDoubtThreadResponse> getAllDoubtThreads(Long optionalCourseId, User tutor) {
        if (tutor.getRole() == UserRole.student) {
            throw new ForbiddenException("ACCESS_DENIED", "Only instructors and administrators can access doubt threads");
        }

        List<Object[]> pairs;
        if (optionalCourseId != null && optionalCourseId > 0) {
            List<Long> studentIds = doubtMessageRepo.findDistinctStudentIdsByCourseId(optionalCourseId);
            pairs = studentIds.stream().map(sId -> new Object[]{ optionalCourseId, sId }).toList();
        } else {
            pairs = doubtMessageRepo.findDistinctCourseAndStudentPairs();
        }

        if (pairs.isEmpty()) return Collections.emptyList();

        List<TutorDoubtThreadResponse> threads = new ArrayList<>();
        for (Object[] pair : pairs) {
            Long cId = (Long) pair[0];
            Long sId = (Long) pair[1];

            Optional<Course> cOpt = courseRepo.findById(cId);
            Optional<User> sOpt = userRepo.findById(sId);
            if (cOpt.isEmpty() || sOpt.isEmpty()) continue;

            Course course = cOpt.get();
            User student = sOpt.get();

            Optional<TutorDoubtMessage> lastMsgOpt = doubtMessageRepo
                    .findFirstByCourseIdAndStudentIdOrderByCreatedAtDesc(cId, sId);
            if (lastMsgOpt.isEmpty()) continue;
            TutorDoubtMessage lastMsg = lastMsgOpt.get();

            Optional<TutorDoubtReadStatus> readOpt = doubtReadRepo
                    .findByUserIdAndCourseIdAndStudentId(tutor.getId(), cId, sId);
            Long lastReadId = readOpt.map(TutorDoubtReadStatus::getLastReadMessageId).orElse(0L);

            long unread = doubtMessageRepo.countUnreadMessages(cId, sId, lastReadId, tutor.getId());
            boolean isWaiting = lastMsg.getSender().getId().equals(sId);

            threads.add(new TutorDoubtThreadResponse(
                    student.getId(),
                    student.getName(),
                    student.getEmail(),
                    student.getProfileImage(),
                    course.getId(),
                    course.getName(),
                    lastMsg.getContent() != null ? lastMsg.getContent() :
                            (lastMsg.getMessageType() == MessageType.image ? "📷 Photo" :
                             lastMsg.getMessageType() == MessageType.video ? "🎥 Video" : "📄 Attachment"),
                    lastMsg.getMessageType().name(),
                    lastMsg.getSender().getRole().name(),
                    lastMsg.getCreatedAt(),
                    unread,
                    isWaiting ? "waiting_for_tutor" : "answered"
            ));
        }

        threads.sort((a, b) -> b.lastMessageTime().compareTo(a.lastMessageTime()));
        return threads;
    }

    /** Direct KPI stats for doubt clearance. */
    @Transactional(readOnly = true)
    public Map<String, Long> getDoubtStats() {
        return Map.of(
                "totalDoubtsAsked", doubtMessageRepo.countTotalDoubtsAsked(),
                "totalDoubtsReplied", doubtMessageRepo.countTotalDoubtsReplied(),
                "pendingDoubts", doubtMessageRepo.countPendingDoubts()
        );
    }

    /** Tutor fetches 1-on-1 messages for a student doubt thread. */
    @Transactional
    public PageResponse<TutorDoubtMessageResponse> getStudentThreadMessages(
            Long courseId, Long studentId, Pageable pageable, User tutor) {
        assertTutorOrAdmin(courseId, tutor);

        Page<TutorDoubtMessage> page = doubtMessageRepo
                .findByCourseIdAndStudentIdOrderByCreatedAtAsc(courseId, studentId, pageable);

        if (page.hasContent()) {
            Long maxId = page.getContent().get(page.getContent().size() - 1).getId();
            markReadInternal(courseId, tutor.getId(), studentId, maxId);
        } else {
            markReadInternal(courseId, tutor.getId(), studentId, null);
        }

        return PageResponse.from(page.map(TutorDoubtMessageResponse::from));
    }

    /** Tutor polls 1-on-1 messages for a student doubt thread. */
    @Transactional(readOnly = true)
    public List<TutorDoubtMessageResponse> pollStudentThreadMessages(
            Long courseId, Long studentId, Long afterId, User tutor) {
        assertTutorOrAdmin(courseId, tutor);

        return doubtMessageRepo
                .findByCourseIdAndStudentIdAndIdGreaterThanOrderByCreatedAtAsc(courseId, studentId, afterId)
                .stream()
                .map(TutorDoubtMessageResponse::from)
                .toList();
    }

    /** Tutor replies to a student doubt. */
    @Transactional
    public TutorDoubtMessageResponse replyToStudentDoubt(
            Long courseId, Long studentId, SendDoubtMessageRequest req, User tutor) {
        if (tutor.getRole() == UserRole.readonly_admin) {
            throw new ForbiddenException("READ_ONLY", "Read-only administrators cannot reply to doubts");
        }
        assertTutorOrAdmin(courseId, tutor);

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        User student = userRepo.findById(studentId)
                .orElseThrow(() -> new NotFoundException("STUDENT_NOT_FOUND", "Student not found"));

        boolean hasContent = req.content() != null && !req.content().isBlank();
        boolean hasMedia   = req.mediaAssetId() != null;
        if (!hasContent && !hasMedia) {
            throw new BadRequestException("INVALID_MESSAGE", "Reply must have text content or an attachment");
        }

        MessageType type = parseMessageType(req.messageType());

        TutorDoubtMessage msg = new TutorDoubtMessage();
        msg.setCourse(course);
        msg.setStudent(student);
        msg.setSender(tutor);
        msg.setContent(hasContent ? req.content().trim() : null);
        msg.setMessageType(type);

        if (hasMedia) {
            MediaAsset asset = mediaAssetRepo.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media attachment not found"));
            msg.setMediaAsset(asset);
        }

        TutorDoubtMessage saved = doubtMessageRepo.save(msg);
        markReadInternal(courseId, tutor.getId(), studentId, saved.getId());

        // Notify student that tutor replied to their doubt
        try {
            String preview = hasContent ? req.content().trim() : "Sent an attachment";
            if (preview.length() > 70) preview = preview.substring(0, 67) + "...";
            String title = "Tutor Replied to Your Doubt in " + course.getName();
            String body = tutor.getName() + ": " + preview;
            String linkUrl = "/student/courses/" + courseId + "/dashboard?tab=doubts";

            notificationService.notify(student, title, body,
                    NotificationType.COMMUNITY, course.getThumbnail(), linkUrl);
        } catch (Exception ignored) {}

        return TutorDoubtMessageResponse.from(saved);
    }

    /** Tutor marks a student thread read. */
    @Transactional
    public void markThreadReadByTutor(Long courseId, Long studentId, Long messageId, User tutor) {
        markReadInternal(courseId, tutor.getId(), studentId, messageId);
    }

    /** Unread doubts badge count for current actor (student or tutor). */
    @Transactional(readOnly = true)
    public long getUnreadDoubtCount(User actor) {
        if (actor.getRole() == UserRole.student) {
            return doubtMessageRepo.countTotalUnreadForStudent(actor.getId());
        } else {
            return doubtMessageRepo.countTotalUnreadForTutor(actor.getId());
        }
    }

    // ── Helper Methods ──────────────────────────────────────────────────────────

    private void markReadInternal(Long courseId, Long userId, Long studentId, Long messageId) {
        try {
            Long readMsgId = messageId;
            if (readMsgId == null || readMsgId <= 0) {
                readMsgId = doubtMessageRepo.findMaxIdByCourseIdAndStudentId(courseId, studentId).orElse(0L);
            }

            Optional<TutorDoubtReadStatus> existing = doubtReadRepo
                    .findByUserIdAndCourseIdAndStudentId(userId, courseId, studentId);

            if (existing.isPresent()) {
                TutorDoubtReadStatus status = existing.get();
                if (readMsgId > status.getLastReadMessageId()) {
                    status.setLastReadMessageId(readMsgId);
                    doubtReadRepo.save(status);
                }
            } else {
                Course courseRef = courseRepo.getReferenceById(courseId);
                User userRef = userRepo.getReferenceById(userId);
                User studentRef = userRepo.getReferenceById(studentId);

                TutorDoubtReadStatus status = new TutorDoubtReadStatus();
                status.setCourse(courseRef);
                status.setUser(userRef);
                status.setStudent(studentRef);
                status.setLastReadMessageId(readMsgId);
                doubtReadRepo.save(status);
            }
        } catch (Exception ignored) {}
    }

    private void assertStudentEnrolled(Long courseId, User student) {
        if (student.getRole() == UserRole.student) {
            boolean enrolled = enrollmentRepo
                    .findByStudentIdAndCourseIdAndStatus(student.getId(), courseId, EnrollmentStatus.active)
                    .isPresent();
            if (!enrolled) {
                throw new ForbiddenException("NOT_ENROLLED", "You are not enrolled in this course");
            }
        }
    }

    private void assertTutorOrAdmin(Long courseId, User user) {
        if (user.getRole() == UserRole.student) {
            throw new ForbiddenException("ACCESS_DENIED", "Only instructors and administrators can access this");
        }
    }

    private List<User> getCourseTutors(Course course) {
        Set<User> tutors = new HashSet<>();
        if (course.getCreatedBy() != null) {
            tutors.add(course.getCreatedBy());
        }
        List<User> admins = userRepo.findByRoleIn(List.of(UserRole.admin, UserRole.super_admin));
        if (admins != null) tutors.addAll(admins);
        return new ArrayList<>(tutors);
    }

    private MessageType parseMessageType(String raw) {
        if (raw == null) return MessageType.text;
        try {
            return MessageType.valueOf(raw.toLowerCase());
        } catch (Exception e) {
            return MessageType.text;
        }
    }
}

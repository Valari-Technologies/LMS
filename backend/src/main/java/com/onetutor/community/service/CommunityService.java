package com.onetutor.community.service;

import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.community.dto.CommunityMessageResponse;
import com.onetutor.community.dto.CourseCommunityStats;
import com.onetutor.community.dto.EditMessageRequest;
import com.onetutor.community.dto.SendMessageRequest;
import com.onetutor.community.entity.CommunityMessage;
import com.onetutor.community.entity.CommunityReadStatus;
import com.onetutor.community.entity.MessageType;
import com.onetutor.community.repository.CommunityMessageRepository;
import com.onetutor.community.repository.CommunityReadStatusRepository;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.media.repository.MediaAssetRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
public class CommunityService {

    private final CommunityMessageRepository messageRepo;
    private final CourseRepository courseRepo;
    private final EnrollmentRepository enrollmentRepo;
    private final MediaAssetRepository mediaAssetRepo;
    private final CommunityReadStatusRepository readStatusRepo;
    private final com.onetutor.community.repository.CommunityMemberStatusRepository memberStatusRepo;
    private final com.onetutor.community.repository.CommunityDisabledIntervalRepository disabledIntervalRepo;
    private final com.onetutor.notifications.service.NotificationService notificationService;

    public CommunityService(CommunityMessageRepository messageRepo,
                            CourseRepository courseRepo,
                            EnrollmentRepository enrollmentRepo,
                            MediaAssetRepository mediaAssetRepo,
                            CommunityReadStatusRepository readStatusRepo,
                            com.onetutor.community.repository.CommunityMemberStatusRepository memberStatusRepo,
                            com.onetutor.community.repository.CommunityDisabledIntervalRepository disabledIntervalRepo,
                            com.onetutor.notifications.service.NotificationService notificationService) {
        this.messageRepo    = messageRepo;
        this.courseRepo     = courseRepo;
        this.enrollmentRepo = enrollmentRepo;
        this.mediaAssetRepo = mediaAssetRepo;
        this.readStatusRepo = readStatusRepo;
        this.memberStatusRepo = memberStatusRepo;
        this.disabledIntervalRepo = disabledIntervalRepo;
        this.notificationService = notificationService;
    }

    // ── Public Methods ──────────────────────────────────────────────────────────

    /** Paginated initial message load (newest page, ascending order). Also marks chat as read. */
    @Transactional
    public PageResponse<CommunityMessageResponse> getMessages(Long courseId,
                                                              Pageable pageable,
                                                              User actor) {
        assertEnrollment(courseId, actor);

        Page<CommunityMessage> page;
        if (actor.getRole() == UserRole.student) {
            // Students only see messages from their enrollment date onward
            java.time.Instant enrolledAt = enrollmentRepo.findEarliestEnrolledAt(actor.getId(), courseId);
            if (enrolledAt == null) enrolledAt = java.time.Instant.EPOCH;
            page = messageRepo.findFilteredMessagesForStudent(courseId, actor.getId(), enrolledAt, pageable);
        } else {
            page = messageRepo.findByCourseIdOrderByCreatedAtAsc(courseId, pageable);
        }

        // Auto-mark as read up to the highest message ID in this page or course
        if (page.hasContent()) {
            Long maxId = page.getContent().get(page.getContent().size() - 1).getId();
            markAsReadInternal(courseId, maxId, actor);
        } else {
            markAsReadInternal(courseId, null, actor);
        }

        return PageResponse.from(page.map(CommunityMessageResponse::from));
    }

    /** Polling — return messages with id > afterId for a course. */
    @Transactional(readOnly = true)
    public List<CommunityMessageResponse> pollMessages(Long courseId, Long afterId, User actor) {
        assertEnrollment(courseId, actor);

        List<CommunityMessage> list;
        if (actor.getRole() == UserRole.student) {
            // Students only see messages from their enrollment date onward
            java.time.Instant enrolledAt = enrollmentRepo.findEarliestEnrolledAt(actor.getId(), courseId);
            if (enrolledAt == null) enrolledAt = java.time.Instant.EPOCH;
            list = messageRepo.pollFilteredMessagesForStudent(courseId, afterId, actor.getId(), enrolledAt);
        } else {
            list = messageRepo.findByCourseIdAndIdGreaterThanOrderByCreatedAtAsc(courseId, afterId);
        }

        return list.stream()
                .map(CommunityMessageResponse::from)
                .toList();
    }

    /** Send a new message. */
    @Transactional
    public CommunityMessageResponse sendMessage(Long courseId, SendMessageRequest req, User actor) {
        if (actor.getRole() == UserRole.readonly_admin) {
            throw new ForbiddenException("READ_ONLY", "Read-only administrators cannot post community messages");
        }
        assertCanWrite(courseId, actor);

        // Must have content or media
        boolean hasContent = req.content() != null && !req.content().isBlank();
        boolean hasMedia   = req.mediaAssetId() != null;
        if (!hasContent && !hasMedia) {
            throw new BadRequestException("INVALID_MESSAGE", "Message must have text content or a media attachment");
        }

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        MessageType type;
        try {
            type = req.messageType() != null
                    ? MessageType.valueOf(req.messageType().toLowerCase())
                    : MessageType.text;
        } catch (IllegalArgumentException e) {
            type = MessageType.text;
        }

        CommunityMessage msg = new CommunityMessage();
        msg.setCourse(course);
        msg.setSender(actor);
        msg.setContent(hasContent ? req.content().trim() : null);
        msg.setMessageType(type);

        if (hasMedia) {
            MediaAsset asset = mediaAssetRepo.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
            msg.setMediaAsset(asset);
        }

        CommunityMessage saved = messageRepo.save(msg);
        // Sender automatically has read up to this message
        markAsReadInternal(courseId, saved.getId(), actor);

        // Notify enrolled students in this course (excluding sender and disabled members)
        try {
            List<User> students = enrollmentRepo.findActiveStudentsByCourseId(courseId);
            List<Long> disabledUserIds = memberStatusRepo.findDisabledUserIdsByCourseId(courseId);
            List<User> recipients = students.stream()
                    .filter(s -> s != null && !s.getId().equals(actor.getId()) && !disabledUserIds.contains(s.getId()))
                    .toList();
            if (!recipients.isEmpty()) {
                String preview = hasContent ? req.content().trim() : "Sent an attachment";
                if (preview.length() > 80) preview = preview.substring(0, 77) + "...";
                String title = "New message in " + course.getName();
                String body = actor.getName() + ": " + preview;
                String linkUrl = "/student/community/" + course.getId();
                notificationService.notifyUsers(recipients, title, body,
                        com.onetutor.notifications.entity.NotificationType.COMMUNITY,
                        course.getThumbnail(), linkUrl);
            }
        } catch (Exception e) {
            // Log and ignore to avoid breaking chat on notification issues
        }

        return CommunityMessageResponse.from(saved);
    }

    /** Edit own message within 10 minutes of sending (WhatsApp-style). */
    @Transactional
    public CommunityMessageResponse editMessage(Long courseId, Long messageId, EditMessageRequest req, User actor) {
        if (actor.getRole() == UserRole.readonly_admin) {
            throw new ForbiddenException("READ_ONLY", "Read-only administrators cannot edit community messages");
        }
        assertCanWrite(courseId, actor);

        CommunityMessage msg = messageRepo.findById(messageId)
                .orElseThrow(() -> new NotFoundException("MESSAGE_NOT_FOUND", "Message not found"));

        if (!msg.getCourse().getId().equals(courseId)) {
            throw new NotFoundException("MESSAGE_NOT_FOUND", "Message not found in this course");
        }

        if (msg.isDeleted()) {
            throw new BadRequestException("MESSAGE_DELETED", "Deleted messages cannot be edited");
        }

        if (!msg.getSender().getId().equals(actor.getId())) {
            throw new ForbiddenException("FORBIDDEN", "You can only edit your own messages");
        }

        // WhatsApp-style 10-minute edit limit
        Instant now = Instant.now();
        Instant createdAt = msg.getCreatedAt();
        Duration diff = Duration.between(createdAt, now);
        if (diff.toMinutes() >= 10 || diff.isNegative()) {
            throw new BadRequestException("EDIT_WINDOW_EXPIRED",
                    "Messages can only be edited within 10 minutes of sending");
        }

        if (req.content() == null || req.content().trim().isEmpty()) {
            throw new BadRequestException("INVALID_CONTENT", "Edited message cannot be empty");
        }

        msg.setContent(req.content().trim());
        msg.setEdited(true);

        return CommunityMessageResponse.from(messageRepo.save(msg));
    }

    /** Soft-delete a message. Students can only delete their own; admins can delete any. */
    @Transactional
    public void deleteMessage(Long courseId, Long messageId, User actor) {
        if (actor.getRole() == UserRole.readonly_admin) {
            throw new ForbiddenException("READ_ONLY", "Read-only administrators cannot delete community messages");
        }
        assertCanWrite(courseId, actor);
        CommunityMessage msg = messageRepo.findById(messageId)
                .orElseThrow(() -> new NotFoundException("MESSAGE_NOT_FOUND", "Message not found"));

        if (!msg.getCourse().getId().equals(courseId)) {
            throw new NotFoundException("MESSAGE_NOT_FOUND", "Message not found in this course");
        }

        boolean isOwner = actor != null && msg.getSender() != null &&
                          actor.getId() != null && msg.getSender().getId() != null &&
                          actor.getId().longValue() == msg.getSender().getId().longValue();

        boolean isAdmin = actor != null && actor.getRole() != UserRole.student;

        if (!isAdmin && !isOwner) {
            throw new ForbiddenException("FORBIDDEN", "You can only delete your own messages");
        }

        // deletedByAdmin is true ONLY if an admin deletes someone else's (a student's) message
        boolean deletedByAdmin = !isOwner && isAdmin && (msg.getSender().getRole() == UserRole.student);

        msg.setDeleted(true);
        msg.setDeletedByAdmin(deletedByAdmin);
        messageRepo.save(msg);
    }

    /** Mark chat as read up to a message ID (or latest). */
    @Transactional
    public void markAsRead(Long courseId, Long messageId, User actor) {
        assertEnrollment(courseId, actor);
        markAsReadInternal(courseId, messageId, actor);
    }

    /** Count how many distinct courses have unread messages (WhatsApp navbar style). */
    @Transactional(readOnly = true)
    public long getUnreadChatCount(User actor) {
        if (actor == null) return 0L;

        if (actor.getRole() != UserRole.student) {
            return messageRepo.countUnreadCoursesForAdmin(actor.getId());
        }

        List<Enrollment> enrollments =
                enrollmentRepo.findAllByStudentIdAndStatusWithCourse(actor.getId(), EnrollmentStatus.active);
        List<Long> courseIds = enrollments.stream().map(e -> e.getCourse().getId()).toList();
        if (courseIds.isEmpty()) {
            return 0L;
        }

        List<Long> disabledCourseIds = memberStatusRepo.findDisabledCourseIdsByUserId(actor.getId());
        List<Long> activeCourseIds = courseIds.stream().filter(id -> !disabledCourseIds.contains(id)).toList();
        if (activeCourseIds.isEmpty()) {
            return 0L;
        }

        return messageRepo.countUnreadCoursesForStudent(actor.getId(), activeCourseIds);
    }

    /** Admin overview — all courses with message counts and unread count for current admin. */
    @Transactional(readOnly = true)
    public List<CourseCommunityStats> getAdminOverview(User actor) {
        Map<Long, Long> unreadMap = new HashMap<>();
        if (actor != null) {
            for (Object[] row : messageRepo.countAllUnreadByCourses(actor.getId())) {
                unreadMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }

        Map<Long, String> latestMsgMap = new HashMap<>();
        for (Object[] row : messageRepo.findLatestMessagesForAllCourses()) {
            Long cId = ((Number) row[0]).longValue();
            String content = (String) row[1];
            String msgType = row[2] != null ? row[2].toString() : "text";
            latestMsgMap.put(cId, formatLastMessage(content, msgType));
        }

        return messageRepo.findCourseMessageCounts()
                .stream()
                .map(row -> {
                    Long cId = (Long) row[0];
                    return new CourseCommunityStats(
                            cId,
                            (String) row[1],
                            (String) row[2],
                            (Long) row[3],
                            0L,
                            unreadMap.getOrDefault(cId, 0L),
                            latestMsgMap.get(cId)
                    );
                })
                .sorted((a, b) -> {
                    int unreadComp = Long.compare(b.unreadCount(), a.unreadCount());
                    if (unreadComp != 0) return unreadComp;
                    return Long.compare(b.totalMessages(), a.totalMessages());
                })
                .toList();
    }

    /** Student overview — enrolled courses with message counts and unread count for student. */
    @Transactional(readOnly = true)
    public List<CourseCommunityStats> getStudentOverview(User actor) {
        List<Enrollment> enrollments =
                enrollmentRepo.findAllByStudentIdAndStatusWithCourse(actor.getId(), EnrollmentStatus.active);

        List<Long> courseIds = enrollments.stream()
                .map(e -> e.getCourse().getId())
                .toList();

        Map<Long, Long> counts = new HashMap<>();
        Map<Long, Long> unreadCounts = new HashMap<>();
        Map<Long, String> latestMsgMap = new HashMap<>();
        if (!courseIds.isEmpty()) {
            for (Object[] row : messageRepo.countFilteredMessagesByCourseIdsForStudent(actor.getId(), courseIds)) {
                counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
            for (Object[] row : messageRepo.countUnreadByCourseIds(actor.getId(), courseIds)) {
                unreadCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
            for (Object[] row : messageRepo.findFilteredLatestMessagesByCourseIdsForStudent(actor.getId(), courseIds)) {
                Long cId = ((Number) row[0]).longValue();
                String content = (String) row[1];
                String msgType = row[2] != null ? row[2].toString() : "text";
                latestMsgMap.put(cId, formatLastMessage(content, msgType));
            }

            // Exclude unread counts for communities where the student is disabled by admin
            List<Long> disabledCourseIds = memberStatusRepo.findDisabledCourseIdsByUserId(actor.getId());
            for (Long disabledCId : disabledCourseIds) {
                unreadCounts.put(disabledCId, 0L);
            }
        }

        List<Long> disabledCourseIds = memberStatusRepo.findDisabledCourseIdsByUserId(actor.getId());

        return enrollments.stream()
                .map(e -> {
                    Course c = e.getCourse();
                    boolean isDisabled = disabledCourseIds.contains(c.getId());
                    return new CourseCommunityStats(
                            c.getId(),
                            c.getName(),
                            c.getThumbnail(),
                            counts.getOrDefault(c.getId(), 0L),
                            0L,
                            unreadCounts.getOrDefault(c.getId(), 0L),
                            latestMsgMap.get(c.getId()),
                            isDisabled
                    );
                })
                .sorted((a, b) -> {
                    int unreadComp = Long.compare(b.unreadCount(), a.unreadCount());
                    if (unreadComp != 0) return unreadComp;
                    return Long.compare(b.totalMessages(), a.totalMessages());
                })
                .toList();
    }

    private String formatLastMessage(String content, String messageType) {
        if (content != null && !content.trim().isEmpty()) {
            return content.trim();
        }
        if (messageType != null) {
            String mt = messageType.toLowerCase();
            if (mt.contains("image")) return "📷 Photo";
            if (mt.contains("video")) return "🎥 Video";
            if (mt.contains("pdf") || mt.contains("file")) return "📄 Attachment";
        }
        return "Attachment";
    }

    // ── Private Helpers ─────────────────────────────────────────────────────────

    private void markAsReadInternal(Long courseId, Long messageId, User actor) {
        Course course = courseRepo.findById(courseId).orElse(null);
        if (course == null) return;

        Long targetMsgId = messageId;
        if (targetMsgId == null || targetMsgId <= 0) {
            targetMsgId = messageRepo.findMaxIdByCourseId(courseId).orElse(0L);
        }

        final Long finalTargetMsgId = targetMsgId;
        try {
            CommunityReadStatus status = readStatusRepo.findByUserIdAndCourseId(actor.getId(), courseId)
                    .orElseGet(() -> new CommunityReadStatus(actor, course, 0L));

            if (finalTargetMsgId > status.getLastReadMessageId()) {
                status.setLastReadMessageId(finalTargetMsgId);
                status.setLastReadAt(Instant.now());
                readStatusRepo.saveAndFlush(status);
            }
        } catch (Exception e) {
            readStatusRepo.findByUserIdAndCourseId(actor.getId(), courseId).ifPresent(status -> {
                if (finalTargetMsgId > status.getLastReadMessageId()) {
                    status.setLastReadMessageId(finalTargetMsgId);
                    status.setLastReadAt(Instant.now());
                    readStatusRepo.save(status);
                }
            });
        }
    }

    // ── Member Management Methods (Admin / Super Admin) ─────────────────────

    @Transactional(readOnly = true)
    public List<com.onetutor.community.dto.CommunityMemberResponse> getCommunityMembers(Long courseId) {
        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        List<Enrollment> enrollments = enrollmentRepo.findActiveEnrollmentsWithStudentByCourseId(courseId);
        List<Long> disabledUserIds = memberStatusRepo.findDisabledUserIdsByCourseId(courseId);

        return enrollments.stream()
                .map(e -> com.onetutor.community.dto.CommunityMemberResponse.of(
                        e.getStudent(),
                        e.getEnrolledAt(),
                        disabledUserIds.contains(e.getStudent().getId())
                ))
                .sorted(java.util.Comparator.comparing(
                        (com.onetutor.community.dto.CommunityMemberResponse m) -> m.name() != null ? m.name() : "",
                        String.CASE_INSENSITIVE_ORDER
                ))
                .toList();
    }

    @Transactional
    public com.onetutor.community.dto.CommunityMemberResponse toggleCommunityMemberStatus(Long courseId,
                                                                                           Long targetUserId,
                                                                                           boolean isDisabled,
                                                                                           User actor) {
        if (actor.getRole() == UserRole.readonly_admin) {
            throw new ForbiddenException("READ_ONLY", "Read-only administrators cannot manage community members");
        }

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        Enrollment enrollment = enrollmentRepo.findByStudentIdAndCourseIdAndStatus(targetUserId, courseId, EnrollmentStatus.active)
                .orElseThrow(() -> new NotFoundException("NOT_ENROLLED", "Student is not active in this course community"));

        User targetUser = enrollment.getStudent();

        com.onetutor.community.entity.CommunityMemberStatus status = memberStatusRepo
                .findByCourseIdAndUserId(courseId, targetUserId)
                .orElseGet(() -> new com.onetutor.community.entity.CommunityMemberStatus(course, targetUser, false));

        boolean wasDisabled = status.isDisabled();
        status.setDisabled(isDisabled);
        memberStatusRepo.save(status);

        if (!wasDisabled && isDisabled) {
            com.onetutor.community.entity.CommunityDisabledInterval interval = new com.onetutor.community.entity.CommunityDisabledInterval();
            interval.setCourse(course);
            interval.setUser(targetUser);
            interval.setDisabledAt(Instant.now());
            interval.setEnabledAt(null);
            disabledIntervalRepo.save(interval);

            // Mark read and clear notifications for this course
            markAsReadInternal(courseId, null, targetUser);
            notificationService.deleteCommunityNotifications(targetUserId, "/student/community/" + courseId);
        } else if (wasDisabled && !isDisabled) {
            disabledIntervalRepo.findByCourseIdAndUserIdAndEnabledAtIsNull(courseId, targetUserId)
                    .ifPresent(interval -> {
                        interval.setEnabledAt(Instant.now());
                        disabledIntervalRepo.save(interval);
                    });

            // Mark read up to current max message ID so student doesn't receive unread counts/toasts for messages sent while disabled
            markAsReadInternal(courseId, null, targetUser);
            notificationService.deleteCommunityNotifications(targetUserId, "/student/community/" + courseId);
        }

        return com.onetutor.community.dto.CommunityMemberResponse.of(targetUser, enrollment.getEnrolledAt(), isDisabled);
    }

    @Transactional(readOnly = true)
    public boolean isStudentDisabledInCommunity(Long courseId, User actor) {
        if (actor == null || actor.getRole() != UserRole.student) return false;
        return getStudentMemberStatus(courseId, actor)
                .map(com.onetutor.community.entity.CommunityMemberStatus::isDisabled)
                .orElse(false);
    }

    private Optional<com.onetutor.community.entity.CommunityMemberStatus> getStudentMemberStatus(Long courseId, User actor) {
        if (actor == null || actor.getRole() != UserRole.student) return Optional.empty();
        return memberStatusRepo.findByCourseIdAndUserId(courseId, actor.getId());
    }

    private void assertEnrollment(Long courseId, User actor) {
        if (actor.getRole() != UserRole.student) return; // all staff members (admins, creators, readonly_admin) always have community view access

        Optional<com.onetutor.enrollment.entity.Enrollment> enrollment =
                enrollmentRepo.findByStudentIdAndCourseIdAndStatus(
                        actor.getId(), courseId, EnrollmentStatus.active);

        if (enrollment.isEmpty()) {
            throw new ForbiddenException("NOT_ENROLLED",
                    "You must be enrolled in this course to access its community");
        }
    }

    private void assertCanWrite(Long courseId, User actor) {
        assertEnrollment(courseId, actor);

        if (actor.getRole() == UserRole.student) {
            Optional<com.onetutor.community.entity.CommunityMemberStatus> memberStatus =
                    memberStatusRepo.findByCourseIdAndUserId(courseId, actor.getId());
            if (memberStatus.isPresent() && memberStatus.get().isDisabled()) {
                throw new ForbiddenException("COMMUNITY_DISABLED",
                        "Your participation in this community chat has been disabled by an administrator");
            }
        }
    }
}

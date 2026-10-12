package com.onetutor.progress.service;

import com.onetutor.contents.entity.Content;
import com.onetutor.contents.entity.ContentStatus;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.progress.dto.*;
import com.onetutor.progress.entity.Progress;
import com.onetutor.progress.repository.ProgressRepository;
import com.onetutor.sections.entity.Section;
import com.onetutor.sections.entity.SectionStatus;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProgressService {

    /** Video completion threshold: video must reach 100% (fully completed) to auto-complete. */
    private static final BigDecimal COMPLETION_THRESHOLD = BigDecimal.valueOf(100);

    private final ProgressRepository progressRepository;
    private final ContentRepository contentRepository;
    private final SectionRepository sectionRepository;
    private final EnrollmentService enrollmentService;
    private final com.onetutor.assessments.repository.AssessmentRepository assessmentRepository;
    private final com.onetutor.assessments.repository.AssessmentAttemptRepository attemptRepository;
    private final com.onetutor.users.repository.UserRepository userRepository;
    private final com.onetutor.progress.repository.VideoPlaybackSessionRepository sessionRepository;

    public ProgressService(ProgressRepository progressRepository,
                            ContentRepository contentRepository,
                            SectionRepository sectionRepository,
                            EnrollmentService enrollmentService,
                            com.onetutor.assessments.repository.AssessmentRepository assessmentRepository,
                            com.onetutor.assessments.repository.AssessmentAttemptRepository attemptRepository,
                            com.onetutor.users.repository.UserRepository userRepository,
                            com.onetutor.progress.repository.VideoPlaybackSessionRepository sessionRepository) {
        this.progressRepository = progressRepository;
        this.contentRepository = contentRepository;
        this.sectionRepository = sectionRepository;
        this.enrollmentService = enrollmentService;
        this.assessmentRepository = assessmentRepository;
        this.attemptRepository = attemptRepository;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    /**
     * Initializes a server-controlled VideoPlaybackSession for anti-cheat tracking.
     */
    @Transactional
    public ContentProgressResponse startPlaybackSession(Long contentId, User student) {
        Content content = findContentOrThrow(contentId);
        enrollmentService.assertActiveEnrollment(student, content.getSection().getCourse().getId());
        assertContentUnlocked(content, student);

        Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                .orElseGet(() -> newProgress(student, content));

        String sessionId = java.util.UUID.randomUUID().toString();
        com.onetutor.progress.entity.VideoPlaybackSession session = new com.onetutor.progress.entity.VideoPlaybackSession();
        session.setSessionId(sessionId);
        session.setUser(student);
        session.setContent(content);
        session.setLastAcceptedPosition(progress.getVideoPosition());
        session.setMaxWatchedPosition(progress.getMaxWatchedPosition());
        sessionRepository.save(session);

        progress.setPlaybackSessionId(sessionId);
        progress.setLastAccessedAt(Instant.now());
        progressRepository.save(progress);

        return toContentResponse(progress);
    }

    /**
     * Persists position + percent with server-controlled anti-cheat validation.
     */
    @Transactional
    public ContentProgressResponse updateProgress(Long contentId, ProgressUpdateRequest req, User student) {
        Content content = findContentOrThrow(contentId);
        com.onetutor.courses.entity.Course course = content.getSection().getCourse();
        enrollmentService.assertActiveEnrollment(student, course.getId());

        if (student != null && student.getId() != null) {
            userRepository.findById(student.getId()).ifPresent(u -> {
                u.setLastActiveAt(Instant.now());
                userRepository.save(u);
            });
        }

        Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                .orElseGet(() -> newProgress(student, content));

        // Retrieve active playback session for anti-cheat validation
        Optional<com.onetutor.progress.entity.VideoPlaybackSession> sessionOpt = Optional.empty();
        if (req.playbackSessionId() != null && !req.playbackSessionId().isBlank()) {
            sessionOpt = sessionRepository.findBySessionIdAndUserIdAndActiveTrue(req.playbackSessionId(), student.getId());
        }
        if (sessionOpt.isEmpty()) {
            sessionOpt = sessionRepository.findFirstByUserIdAndContentIdAndActiveTrueOrderByCreatedAtDesc(student.getId(), contentId);
        }

        int oldMaxWatched = progress.getMaxWatchedPosition();
        int requestedMaxWatched = req.maxWatchedPosition() != null ? req.maxWatchedPosition() : Math.max(oldMaxWatched, req.videoPosition());

        int validatedMaxWatched = oldMaxWatched;
        double rate = req.playbackRate() != null && req.playbackRate() > 0 ? req.playbackRate() : 1.0;

        if (sessionOpt.isPresent()) {
            var session = sessionOpt.get();
            long elapsedSeconds = Math.max(0, java.time.Duration.between(session.getLastHeartbeatAt(), Instant.now()).toSeconds());
            int maxAllowedAdvance = (int) Math.round(elapsedSeconds * rate * 1.6) + 6; // 1.6x tolerance + 6s grace buffer
            validatedMaxWatched = Math.min(requestedMaxWatched, session.getMaxWatchedPosition() + maxAllowedAdvance);
        } else {
            long elapsedSeconds = progress.getLastProgressAt() != null
                    ? Math.max(0, java.time.Duration.between(progress.getLastProgressAt(), Instant.now()).toSeconds())
                    : 15;
            int maxAllowedAdvance = (int) Math.round(elapsedSeconds * rate * 1.6) + 6;
            validatedMaxWatched = Math.min(requestedMaxWatched, oldMaxWatched + maxAllowedAdvance);
        }

        // Monotonic progression rule: maxWatchedPosition NEVER decreases!
        int finalMaxWatched = Math.max(oldMaxWatched, validatedMaxWatched);
        progress.setMaxWatchedPosition(finalMaxWatched);
        progress.setLastProgressAt(Instant.now());

        // Update videoPosition: capped to finalMaxWatched if sequentialVideoEnabled
        if (course.isSequentialVideoEnabled()) {
            progress.setVideoPosition(Math.min(req.videoPosition(), finalMaxWatched));
        } else {
            progress.setVideoPosition(req.videoPosition());
        }

        // Update watchedSeconds
        progress.setWatchedSeconds(Math.max(progress.getWatchedSeconds(), finalMaxWatched));

        // Sync playback session
        sessionOpt.ifPresent(s -> {
            s.setLastHeartbeatAt(Instant.now());
            s.setMaxWatchedPosition(finalMaxWatched);
            s.setLastAcceptedPosition(progress.getVideoPosition());
            s.setPlaybackRate(rate);
            sessionRepository.save(s);
        });

        // Compute completion percentage based on threshold
        if (req.videoDuration() != null && req.videoDuration() > 0) {
            double watchPct = ((double) finalMaxWatched / req.videoDuration()) * 100.0;
            int computedPct = (int) Math.min(100, Math.round(watchPct));
            if (computedPct > progress.getProgressPercentInt()) {
                progress.setProgressPercent(computedPct);
            }
        } else if (req.progressPercent() != null) {
            if (req.progressPercent().intValue() > progress.getProgressPercentInt()) {
                progress.setProgressPercent(req.progressPercent());
            }
        }

        boolean hasAssessment = assessmentRepository.findByContentId(contentId).isPresent();
        boolean hasPassedAssessment = hasAssessment && !attemptRepository.findPassedAttempts(student.getId(), contentId).isEmpty();

        if (hasAssessment) {
            if (hasPassedAssessment) {
                progress.setCompleted(true);
                progress.setProgressPercent(100);
                if (progress.getCompletedAt() == null) progress.setCompletedAt(Instant.now());
            } else {
                progress.setCompleted(false);
                progress.setCompletedAt(null);
                if (progress.getProgressPercentInt() >= 100) progress.setProgressPercent(99);
            }
        } else if (!progress.isCompleted()) {
            int threshold = course.getVideoCompletionThreshold();
            if (progress.getProgressPercentInt() >= threshold) {
                progress.setCompleted(true);
                progress.setCompletedAt(Instant.now());
                progress.setProgressPercent(100);
            }
        }

        progress.setLastAccessedAt(Instant.now());
        progressRepository.save(progress);

        return toContentResponse(progress);
    }

    /**
     * SRS section 12/58: toggles completion state for content.
     */
    @Transactional
    public ContentProgressResponse markComplete(Long contentId, User student) {
        Content content = findContentOrThrow(contentId);
        Long courseId = content.getSection().getCourse().getId();
        enrollmentService.assertActiveEnrollment(student, courseId);

        Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                .orElseGet(() -> newProgress(student, content));

        boolean hasAssessment = assessmentRepository.findByContentId(contentId).isPresent();
        if (hasAssessment) {
            boolean hasPassed = !attemptRepository.findPassedAttempts(student.getId(), contentId).isEmpty();
            if (!hasPassed) {
                // Assessment is required to complete this lesson!
                progress.setCompleted(false);
                progress.setCompletedAt(null);
                progress.setProgressPercent(BigDecimal.valueOf(99));
                progress.setLastAccessedAt(Instant.now());
                progressRepository.save(progress);
                return toContentResponse(progress);
            }
        }

        if (progress.isCompleted()) {
            progress.setCompleted(false);
            progress.setCompletedAt(null);
            progress.setProgressPercent(BigDecimal.ZERO);
        } else {
            progress.setProgressPercent(BigDecimal.valueOf(100));
            progress.setCompleted(true);
            progress.setCompletedAt(Instant.now());
        }
        progress.setLastAccessedAt(Instant.now());
        progressRepository.save(progress);

        return toContentResponse(progress);
    }

    /** Records that a student opened content, without changing completion state. Powers "last accessed". */
    @Transactional
    public void recordAccess(Long contentId, User student) {
        Content content = findContentOrThrow(contentId);
        enrollmentService.assertActiveEnrollment(student, content.getSection().getCourse().getId());
        if (student != null && student.getId() != null) {
            userRepository.findById(student.getId()).ifPresent(u -> {
                u.setLastActiveAt(Instant.now());
                userRepository.save(u);
            });
        }

        Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                .orElseGet(() -> newProgress(student, content));
        progress.setLastAccessedAt(Instant.now());
        progressRepository.save(progress);
    }

    @Transactional
    public ContentProgressResponse getContentProgress(Long contentId, User student) {
        if (student != null && student.getId() != null) {
            userRepository.findById(student.getId()).ifPresent(u -> {
                u.setLastActiveAt(Instant.now());
                userRepository.save(u);
            });
            Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                    .orElseGet(() -> {
                        Content content = findContentOrThrow(contentId);
                        return newProgress(student, content);
                    });
            progress.setLastAccessedAt(Instant.now());
            progressRepository.save(progress);
            return toContentResponse(progress);
        }
        return progressRepository.findByStudentIdAndContentId(student.getId(), contentId)
                .map(this::toContentResponse)
                .orElse(new ContentProgressResponse(contentId, BigDecimal.ZERO, 0, false, null, null));
    }

    /**
     * SRS section 19-20: course/section progress derived from content
     * completion state, computed at read time — never stored, never based
     * on total video time watched.
     */
    public CourseProgressResponse getCourseProgress(Long courseId, User student) {
        enrollmentService.assertActiveEnrollment(student, courseId);
        return getCourseProgressForStudent(courseId, student.getId());
    }

    public CourseProgressResponse getCourseProgressForStudent(Long courseId, Long studentId) {

        List<Section> sections = sectionRepository.findByCourseIdOrderByDisplayOrderAsc(courseId).stream()
                .filter(s -> s.getStatus() == SectionStatus.active)
                .toList();

        Set<Long> activeSectionIds = sections.stream().map(Section::getId).collect(Collectors.toSet());

        List<Content> allContents = contentRepository.findAllByCourseIdOrdered(courseId).stream()
                .filter(c -> c.getStatus() == ContentStatus.active && activeSectionIds.contains(c.getSection().getId()))
                .toList();

        Map<Long, List<Content>> bySection = allContents.stream()
                .collect(Collectors.groupingBy(c -> c.getSection().getId()));

        List<Long> allContentIds = allContents.stream().map(Content::getId).toList();
        List<Progress> progressList = allContentIds.isEmpty() ? List.of()
                : progressRepository.findByStudentIdAndContentIdIn(studentId, allContentIds);
        Map<Long, Progress> progressMap = progressList.stream()
                .collect(Collectors.toMap(p -> p.getContent().getId(), p -> p, (p1, p2) -> p1));

        long totalCompleted = 0;
        for (Content c : allContents) {
            Progress p = progressMap.get(c.getId());
            boolean hasAssessment = assessmentRepository.findByContentId(c.getId()).isPresent();
            boolean hasPassed = hasAssessment && !attemptRepository.findPassedAttempts(studentId, c.getId()).isEmpty();
            
            boolean isCompleted = false;
            if (hasAssessment) {
                isCompleted = hasPassed;
            } else {
                isCompleted = (p != null && p.isCompleted());
            }

            if (isCompleted) {
                totalCompleted++;
                if (p != null && (!p.isCompleted() || p.getProgressPercentInt() < 100)) {
                    p.setCompleted(true);
                    p.setProgressPercent(100);
                    progressRepository.save(p);
                }
            } else if (hasAssessment && p != null && p.isCompleted()) {
                p.setCompleted(false);
                p.setCompletedAt(null);
                p.setProgressPercent(99);
                progressRepository.save(p);
            }
        }

        List<CourseProgressResponse.SectionProgress> sectionProgress = sections.stream().map(s -> {
            List<Content> sectionContents = bySection.getOrDefault(s.getId(), List.of());
            if (sectionContents.isEmpty()) {
                return new CourseProgressResponse.SectionProgress(s.getId(), s.getTitle(), 0, 0, 0.0);
            }
            long completed = 0;
            double sectionSum = 0.0;
            for (Content c : sectionContents) {
                Progress p = progressMap.get(c.getId());
                boolean hasAssessment = assessmentRepository.findByContentId(c.getId()).isPresent();
                boolean hasPassed = hasAssessment && !attemptRepository.findPassedAttempts(studentId, c.getId()).isEmpty();
                
                boolean isDone = false;
                if (hasAssessment) {
                    isDone = hasPassed;
                    sectionSum += hasPassed ? 100.0 : (p != null && p.getProgressPercent() != null ? Math.min(99.0, p.getProgressPercent().doubleValue()) : 0.0);
                } else {
                    isDone = (p != null && p.isCompleted());
                    if (isDone) {
                        sectionSum += 100.0;
                    } else if (p != null && p.getProgressPercent() != null) {
                        sectionSum += p.getProgressPercent().doubleValue();
                    }
                }
                if (isDone) completed++;
            }
            double pct = sectionSum / sectionContents.size();
            if (completed < sectionContents.size() && pct >= 99.5) {
                pct = 99.0;
            }
            return new CourseProgressResponse.SectionProgress(s.getId(), s.getTitle(), sectionContents.size(), (int) completed, round1(pct));
        }).toList();

        double totalSum = 0.0;
        for (Content c : allContents) {
            Progress p = progressMap.get(c.getId());
            boolean hasAssessment = assessmentRepository.findByContentId(c.getId()).isPresent();
            boolean hasPassed = hasAssessment && !attemptRepository.findPassedAttempts(studentId, c.getId()).isEmpty();
            
            if (hasAssessment) {
                totalSum += hasPassed ? 100.0 : (p != null && p.getProgressPercent() != null ? Math.min(99.0, p.getProgressPercent().doubleValue()) : 0.0);
            } else {
                if (p != null && p.isCompleted()) {
                    totalSum += 100.0;
                } else if (p != null && p.getProgressPercent() != null) {
                    totalSum += p.getProgressPercent().doubleValue();
                }
            }
        }

        double overallPct = allContentIds.isEmpty() ? 0.0 : totalSum / allContentIds.size();
        if (totalCompleted < allContentIds.size() && overallPct >= 99.5) {
            overallPct = 99.0;
        }

        Instant maxLastAccessedAt = progressList.stream()
                .map(Progress::getLastAccessedAt)
                .filter(java.util.Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(null);

        return new CourseProgressResponse(courseId, allContentIds.size(), (int) totalCompleted,
                round1(overallPct), sectionProgress, maxLastAccessedAt);
    }

    /**
     * SRS section 21-22: "Continue Learning" — the most recently accessed
     * content across all of this student's courses.
     */
    public Optional<ContinueLearningResponse> continueLearning(User student) {
        List<Progress> recentProgressList = progressRepository.findByStudentIdOrderByLastAccessedAtDesc(student.getId());
        for (Progress p : recentProgressList) {
            Content content = p.getContent();
            if (content == null || content.getSection() == null || content.getSection().getCourse() == null) {
                continue;
            }
            Section section = content.getSection();
            Long courseId = section.getCourse().getId();
            if (!enrollmentService.isActivelyEnrolled(student.getId(), courseId)) {
                continue;
            }
            CourseProgressResponse courseProg = getCourseProgress(courseId, student);
            return Optional.of(new ContinueLearningResponse(
                    courseId, section.getCourse().getName(),
                    section.getId(), section.getTitle(),
                    content.getId(), content.getTitle(),
                    courseProg.progressPercent()
            ));
        }
        return Optional.empty();
    }

    private void applyCompletionRule(Progress progress) {
        if (!progress.isCompleted() && progress.getProgressPercent() != null
                && progress.getProgressPercent().compareTo(COMPLETION_THRESHOLD) >= 0) {
            boolean hasAssessment = assessmentRepository.findByContentId(progress.getContent().getId()).isPresent();
            if (hasAssessment) {
                boolean hasPassed = !attemptRepository.findPassedAttempts(progress.getStudent().getId(), progress.getContent().getId()).isEmpty();
                if (hasPassed) {
                    progress.setCompleted(true);
                    progress.setCompletedAt(Instant.now());
                } else {
                    progress.setCompleted(false);
                    progress.setProgressPercent(BigDecimal.valueOf(99));
                }
            } else {
                progress.setCompleted(true);
                progress.setCompletedAt(Instant.now());
            }
        }
    }

    private Progress newProgress(User student, Content content) {
        Progress p = new Progress();
        p.setStudent(student);
        p.setContent(content);
        return p;
    }

    private Content findContentOrThrow(Long id) {
        return contentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("CONTENT_NOT_FOUND", "Content not found"));
    }

    private ContentProgressResponse toContentResponse(Progress p) {
        return new ContentProgressResponse(p.getContent().getId(), p.getProgressPercent(),
                p.getVideoPosition(), p.getMaxWatchedPosition(), p.getPlaybackSessionId(),
                p.isCompleted(), p.getCompletedAt(), p.getLastAccessedAt());
    }

    public void assertContentUnlocked(Content content, User student) {
        if (student == null || student.getRole() != com.onetutor.users.entity.UserRole.student) return;
        com.onetutor.courses.entity.Course course = content.getSection().getCourse();
        if (!course.isSequentialLessonUnlocking()) return;

        List<Content> allCourseContents = contentRepository.findAllByCourseIdOrdered(course.getId())
                .stream()
                .filter(c -> c.getStatus() == ContentStatus.active)
                .toList();

        int currentIndex = -1;
        for (int i = 0; i < allCourseContents.size(); i++) {
            if (allCourseContents.get(i).getId().equals(content.getId())) {
                currentIndex = i;
                break;
            }
        }

        if (currentIndex <= 0) {
            return; // First lesson in the course is always unlocked
        }

        // Inspect all preceding active lessons in the course
        for (int i = 0; i < currentIndex; i++) {
            Content prev = allCourseContents.get(i);
            Progress prevProgress = progressRepository.findByStudentIdAndContentId(student.getId(), prev.getId()).orElse(null);
            boolean isDone = prevProgress != null && prevProgress.isCompleted();

            var assessmentOpt = assessmentRepository.findByContentId(prev.getId());
            if (assessmentOpt.isPresent() && assessmentOpt.get().isEnabled() && assessmentOpt.get().isRequired()) {
                var assessment = assessmentOpt.get();
                var passedAttempts = attemptRepository.findPassedAttempts(student.getId(), prev.getId());
                boolean passed = passedAttempts.stream().anyMatch(a ->
                        a.getPercentage() >= assessment.getPassPercentage() ||
                        assessment.getCompletionMode() == com.onetutor.assessments.entity.CompletionMode.SUBMIT_ASSESSMENT
                );

                if (!passed) {
                    throw new com.onetutor.common.exceptions.ForbiddenException("ASSESSMENT_REQUIRED",
                            "You must successfully complete the required assessment for '" + prev.getTitle() + "' before accessing this lesson.");
                }
            } else if (!isDone) {
                throw new com.onetutor.common.exceptions.ForbiddenException("PREVIOUS_LESSON_REQUIRED",
                        "You must complete '" + prev.getTitle() + "' before unlocking this lesson.");
            }
        }
    }

    public boolean isContentUnlocked(Content content, User student) {
        try {
            assertContentUnlocked(content, student);
            return true;
        } catch (com.onetutor.common.exceptions.ForbiddenException e) {
            return false;
        }
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}

package com.onetutor.courses.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.categories.entity.Category;
import com.onetutor.categories.service.CategoryService;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.entity.Resource;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.contents.repository.ResourceRepository;
import com.onetutor.courses.dto.CourseCardResponse;
import com.onetutor.courses.dto.CourseDetailResponse;
import com.onetutor.courses.dto.CourseRequest;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.sections.entity.Section;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class CourseService {

    private static final Logger log = LoggerFactory.getLogger(CourseService.class);

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final ContentRepository contentRepository;
    private final ResourceRepository resourceRepository;
    private final CategoryService categoryService;
    private final AuditService auditService;
    private final com.onetutor.enrollment.repository.EnrollmentRepository enrollmentRepository;
    private final com.onetutor.users.repository.UserRepository userRepository;
    private final com.onetutor.notifications.service.NotificationService notificationService;
    private final ObjectMapper objectMapper;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public CourseService(CourseRepository courseRepository,
                          SectionRepository sectionRepository,
                          ContentRepository contentRepository,
                          ResourceRepository resourceRepository,
                          CategoryService categoryService,
                          AuditService auditService,
                          com.onetutor.enrollment.repository.EnrollmentRepository enrollmentRepository,
                          com.onetutor.users.repository.UserRepository userRepository,
                          com.onetutor.notifications.service.NotificationService notificationService,
                          ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.sectionRepository = sectionRepository;
        this.contentRepository = contentRepository;
        this.resourceRepository = resourceRepository;
        this.categoryService = categoryService;
        this.auditService = auditService;
        this.enrollmentRepository = enrollmentRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    /** Public catalog — SRS section 23: published courses only. */
    public PageResponse<CourseCardResponse> browseCatalog(String search, Long categoryId, Pageable pageable) {
        String cleanSearch = (search == null || search.isBlank()) ? null : search.trim();
        Page<Course> page;
        if (cleanSearch != null && categoryId != null) {
            page = courseRepository.searchPublishedByCategoryAndText(categoryId, cleanSearch, pageable);
        } else if (cleanSearch != null) {
            page = courseRepository.searchPublishedByText(cleanSearch, pageable);
        } else if (categoryId != null) {
            page = courseRepository.findPublishedByCategory(categoryId, pageable);
        } else {
            page = courseRepository.findPublished(pageable);
        }
        return PageResponse.from(page.map(this::toCard));
    }

    /** Admin listing — all statuses (SRS section 27/31), optionally filtered by status. */
    public PageResponse<CourseDetailResponse> adminList(String status, Pageable pageable) {
        Page<Course> page = (status == null || status.isBlank())
                ? courseRepository.findAll(pageable)
                : courseRepository.findByStatus(CourseStatus.valueOf(status), pageable);
        return PageResponse.from(page.map(this::toDetail));
    }

    /**
     * SRS section 24: pre-enrollment detail view. Draft/archived courses are
     * only visible to an authenticated admin (never to students, never to
     * the public) — draft courses must never leak through this endpoint.
     */
    public CourseDetailResponse getDetail(Long id, User caller) {
        Course course = findOrThrow(id);
        boolean isAdmin = caller != null && (caller.getRole() == com.onetutor.users.entity.UserRole.admin
                || caller.getRole() == com.onetutor.users.entity.UserRole.super_admin
                || caller.getRole() == com.onetutor.users.entity.UserRole.content_creator);
        boolean isEnrolled = caller != null && enrollmentRepository.findByStudentIdAndCourseIdAndStatus(
                caller.getId(), course.getId(), EnrollmentStatus.active).isPresent();
        if (course.getStatus() != CourseStatus.published && !isAdmin && !isEnrolled) {
            throw new NotFoundException("COURSE_NOT_FOUND", "Course not found");
        }
        return toDetail(course);
    }

    /** Admin preview — SRS section 32: shows the course regardless of status, admin-only. */
    public CourseDetailResponse preview(Long id) {
        return toDetail(findOrThrow(id));
    }

    @Transactional
    public CourseDetailResponse create(CourseRequest req, User actor) {
        Category category = categoryService.assertSelectable(req.categoryId());

        Course course = new Course();
        applyRequest(course, req, category);
        course.setStatus(CourseStatus.draft);
        course.setCreatedBy(actor);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_CREATED", "course", course.getId(),
                "Created course '" + course.getName() + "'");
        return toDetail(course);
    }

    /**
     * SRS section 31/60: modifying a PUBLISHED course bumps its version
     * rather than mutating history silently — students already learning
     * are unaffected in identity (same course_id, same enrollment/progress
     * rows), but the version counter signals a significant-content change
     * occurred. Draft courses are edited in place with no version bump.
     */
    @Transactional
    public CourseDetailResponse update(Long id, CourseRequest req, User actor) {
        Course course = findOrThrow(id);
        Category category = categoryService.assertSelectable(req.categoryId());

        boolean isCreator = actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator;

        if (isCreator) {
            // When Content Creator edits ANY course:
            // Keep the live course 100% untouched for students!
            // Store proposed edits as JSON in pending_edits column and mark pendingApproval = true.
            try {
                String jsonPayload = objectMapper.writeValueAsString(req);
                course.setPendingEdits(jsonPayload);
                course.setPendingApproval(true);
            } catch (Exception e) {
                log.error("Failed to serialize pending edits for course {}", id, e);
                course.setPendingApproval(true);
            }
            courseRepository.save(course);
            auditService.log(actor, "COURSE_EDIT_SUBMITTED", "course", course.getId(),
                    "Content Creator submitted edits for course '" + course.getName() + "' pending Super Admin approval");
            return toDetail(course);
        }

        applyRequest(course, req, category);
        course.setPendingApproval(false);
        course.setPendingEdits(null);
        if (course.getStatus() == CourseStatus.published) {
            course.setVersion(course.getVersion() + 1);
        }
        courseRepository.save(course);

        auditService.log(actor, "COURSE_UPDATED", "course", course.getId(),
                "Updated course '" + course.getName() + "' (version " + course.getVersion() + ")");

        // If published course updated by admin, notify enrolled students
        if (course.getStatus() == CourseStatus.published) {
            try {
                List<User> students = enrollmentRepository.findActiveStudentsByCourseId(course.getId());
                if (students != null && !students.isEmpty()) {
                    String cleanName = course.getName() != null ? course.getName().replaceAll("\\.$", "").trim() : "";
                    String title = "Course Updated: " + cleanName;
                    String body = "New content and updates have been published for '" + cleanName + "'. Check out what's new!";
                    String linkUrl = "/student/courses/" + course.getId();
                    notificationService.notifyUsers(students, title, body,
                            com.onetutor.notifications.entity.NotificationType.COURSE,
                            course.getThumbnail(), linkUrl);
                }
            } catch (Exception e) {
                // ignore
            }
        }

        return toDetail(course);
    }

    @Transactional
    public CourseDetailResponse approveEdits(Long id, User actor) {
        if (actor != null && actor.getRole() == UserRole.content_creator) {
            throw new ForbiddenException("APPROVE_RESTRICTED", "Content Creators cannot approve edits. Only Super Admins can approve course edits.");
        }
        Course course = findOrThrow(id);
        if (course.getPendingEdits() != null && !course.getPendingEdits().isBlank()) {
            try {
                CourseRequest req = objectMapper.readValue(course.getPendingEdits(), CourseRequest.class);
                Category category = req.categoryId() != null ? categoryService.assertSelectable(req.categoryId()) : course.getCategory();
                applyRequest(course, req, category);
            } catch (Exception e) {
                log.error("Failed to parse and apply pending edits for course {}", id, e);
            }
        }

        // Promote all pending_approval sections and contents to active status when approved by Super Admin
        entityManager.createNativeQuery("UPDATE sections SET status = 'active' WHERE course_id = :courseId AND status = 'pending_approval'")
                .setParameter("courseId", id)
                .executeUpdate();

        entityManager.createNativeQuery("UPDATE contents SET status = 'active' WHERE section_id IN (SELECT id FROM sections WHERE course_id = :courseId) AND status = 'pending_approval'")
                .setParameter("courseId", id)
                .executeUpdate();

        entityManager.flush();
        entityManager.clear();

        course = findOrThrow(id);
        course.setPendingApproval(false);
        course.setPendingEdits(null);
        course.setStatus(CourseStatus.published);
        course.setVersion(course.getVersion() + 1);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_EDITS_APPROVED", "course", id, "Approved and published edits for course '" + course.getName() + "'");

        try {
            List<User> students = enrollmentRepository.findActiveStudentsByCourseId(course.getId());
            if (students != null && !students.isEmpty()) {
                String cleanName = course.getName() != null ? course.getName().replaceAll("\\.$", "").trim() : "";
                String title = "Course Updated: " + cleanName;
                String body = "New content and updates have been published for '" + cleanName + "'. Check out what's new!";
                String linkUrl = "/student/courses/" + course.getId();
                notificationService.notifyUsers(students, title, body,
                        com.onetutor.notifications.entity.NotificationType.COURSE,
                        course.getThumbnail(), linkUrl);
            }
        } catch (Exception e) {
            // ignore
        }

        return toDetail(course);
    }

    @Transactional
    public CourseDetailResponse rejectEdits(Long id, User actor) {
        if (actor != null && actor.getRole() == UserRole.content_creator) {
            throw new ForbiddenException("REJECT_RESTRICTED", "Content Creators cannot reject edits.");
        }
        Course course = findOrThrow(id);

        // Delete unapproved pending_approval contents and sections
        entityManager.createNativeQuery("DELETE FROM contents WHERE section_id IN (SELECT id FROM sections WHERE course_id = :courseId) AND status = 'pending_approval'")
                .setParameter("courseId", id)
                .executeUpdate();

        entityManager.createNativeQuery("DELETE FROM sections WHERE course_id = :courseId AND status = 'pending_approval'")
                .setParameter("courseId", id)
                .executeUpdate();

        course.setPendingApproval(false);
        course.setPendingEdits(null);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_EDITS_REJECTED", "course", id, "Rejected proposed edits for course '" + course.getName() + "'");
        return toDetail(course);
    }

    @Transactional
    public CourseDetailResponse publish(Long id, User actor) {
        if (actor != null && actor.getRole() == UserRole.content_creator) {
            throw new ForbiddenException("PUBLISH_RESTRICTED", "Content Creators cannot publish courses directly. Edits require Super Admin approval.");
        }
        Course course = findOrThrow(id);
        if (sectionRepository.countByCourseId(id) == 0) {
            throw new BadRequestException("COURSE_EMPTY", "Add at least one section before publishing");
        }
        if (course.isPendingApproval()) {
            return approveEdits(id, actor);
        }
        course.setStatus(CourseStatus.published);
        course.setPendingApproval(false);
        course.setPendingEdits(null);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_PUBLISHED", "course", id, "Published course '" + course.getName() + "'");

        // Notify active students that enrollments are now open
        try {
            List<User> students = userRepository.findByRoleAndStatus(
                    com.onetutor.users.entity.UserRole.student,
                    com.onetutor.users.entity.UserStatus.active);
            if (students != null && !students.isEmpty()) {
                String cleanName = course.getName() != null ? course.getName().replaceAll("\\.$", "").trim() : "";
                String title = "Enrollments Open: " + cleanName;
                String body = "Enrollments are now open for '" + cleanName + "'! Explore syllabus and enroll today.";
                String linkUrl = "/student/courses/" + course.getId();
                notificationService.notifyUsers(students, title, body,
                        com.onetutor.notifications.entity.NotificationType.COURSE,
                        course.getThumbnail(), linkUrl);
            }
        } catch (Exception e) {
            // ignore
        }

        return toDetail(course);
    }

    @Transactional
    public CourseDetailResponse unpublish(Long id, User actor) {
        if (actor != null && actor.getRole() == UserRole.content_creator) {
            throw new ForbiddenException("UNPUBLISH_RESTRICTED", "Content Creators cannot unpublish courses. Only Super Admins can publish or unpublish courses.");
        }
        Course course = findOrThrow(id);
        course.setStatus(CourseStatus.draft);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_UNPUBLISHED", "course", id, "Unpublished course '" + course.getName() + "'");
        return toDetail(course);
    }

    /** Archiving never removes the course row — enrolled students retain access (SRS section 10/16). */
    @Transactional
    public CourseDetailResponse archive(Long id, User actor) {
        if (actor != null && actor.getRole() == UserRole.content_creator) {
            throw new ForbiddenException("ARCHIVE_RESTRICTED", "Content Creators cannot archive courses. Only Super Admins can archive courses.");
        }
        Course course = findOrThrow(id);
        course.setStatus(CourseStatus.archived);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_ARCHIVED", "course", id, "Archived course '" + course.getName() + "'");
        return toDetail(course);
    }

    /** Restores an archived course back to draft status so admins can review/update/publish it. */
    @Transactional
    public CourseDetailResponse unarchive(Long id, User actor) {
        Course course = findOrThrow(id);
        course.setStatus(CourseStatus.draft);
        courseRepository.save(course);

        auditService.log(actor, "COURSE_UNARCHIVED", "course", id, "Unarchived course '" + course.getName() + "'");
        return toDetail(course);
    }

    /**
     * SRS section 33: copies metadata + sections + content + ordering into
     * a brand-new DRAFT course. Never copies enrollments or progress —
     * those don't exist on the new course_id at all, so there is nothing
     * to accidentally carry over.
     */
    @Transactional
    public CourseDetailResponse duplicate(Long id, User actor) {
        Course original = findOrThrow(id);

        Course copy = new Course();
        copy.setName(original.getName() + " (Copy)");
        copy.setShortDesc(original.getShortDesc());
        copy.setDescription(original.getDescription());
        copy.setThumbnail(original.getThumbnail());
        copy.setCategory(original.getCategory());
        copy.setLevel(original.getLevel());
        copy.setDuration(original.getDuration());
        copy.setLanguage(original.getLanguage());
        copy.setPrerequisites(original.getPrerequisites());
        copy.setLearningOutcomes(original.getLearningOutcomes());
        copy.setStatus(CourseStatus.draft);
        copy.setVersion(1);
        copy.setCreatedBy(actor);
        courseRepository.save(copy);

        Map<Long, Section> sectionMap = new HashMap<>();
        for (Section s : sectionRepository.findByCourseIdOrderByDisplayOrderAsc(original.getId())) {
            Section newSection = new Section();
            newSection.setCourse(copy);
            newSection.setTitle(s.getTitle());
            newSection.setDescription(s.getDescription());
            newSection.setDisplayOrder(s.getDisplayOrder());
            sectionRepository.save(newSection);
            sectionMap.put(s.getId(), newSection);

            for (Content c : contentRepository.findBySectionIdOrderByDisplayOrderAsc(s.getId())) {
                Content newContent = new Content();
                newContent.setSection(newSection);
                newContent.setTitle(c.getTitle());
                newContent.setDescription(c.getDescription());
                newContent.setContentType(c.getContentType());
                newContent.setMediaReference(c.getMediaReference());
                newContent.setDisplayOrder(c.getDisplayOrder());
                newContent.setCompletionRule(c.getCompletionRule());
                contentRepository.save(newContent);

                for (Resource r : resourceRepository.findByContentIdOrderByDisplayOrderAsc(c.getId())) {
                    Resource newResource = new Resource();
                    newResource.setContent(newContent);
                    newResource.setType(r.getType());
                    newResource.setName(r.getName());
                    newResource.setUrl(r.getUrl());
                    newResource.setDisplayOrder(r.getDisplayOrder());
                    resourceRepository.save(newResource);
                }
            }
        }

        auditService.log(actor, "COURSE_DUPLICATED", "course", copy.getId(),
                "Duplicated course " + original.getId() + " ('" + original.getName() + "') into new draft " + copy.getId());
        return toDetail(copy);
    }

    private void applyRequest(Course course, CourseRequest req, Category category) {
        course.setName(req.name());
        course.setShortDesc(req.shortDesc());
        course.setDescription(req.description());
        course.setThumbnail(req.thumbnail());
        course.setCategory(category);
        course.setLevel(req.level());
        course.setDuration(req.duration());
        course.setLanguage(req.language());
        course.setPrerequisites(req.prerequisites());
        course.setLearningOutcomes(req.learningOutcomes());
        if (req.sequentialVideoEnabled() != null) course.setSequentialVideoEnabled(req.sequentialVideoEnabled());
        if (req.requireVideoCompletion() != null) course.setRequireVideoCompletion(req.requireVideoCompletion());
        if (req.sequentialLessonUnlocking() != null) course.setSequentialLessonUnlocking(req.sequentialLessonUnlocking());
        if (req.pauseOnTabInactive() != null) course.setPauseOnTabInactive(req.pauseOnTabInactive());
        if (req.videoCompletionThreshold() != null) course.setVideoCompletionThreshold(req.videoCompletionThreshold());
        if (req.progressSaveInterval() != null) course.setProgressSaveInterval(req.progressSaveInterval());

        if (req.pricingType() != null && !req.pricingType().isBlank()) {
            course.setPricingType(req.pricingType().trim().toLowerCase());
        }
        if (req.price() != null) {
            course.setPrice(Math.max(0.0, req.price()));
        }
        if (req.currency() != null && !req.currency().isBlank()) {
            course.setCurrency(req.currency().trim().toUpperCase());
        }
        if (req.subscriptionPeriod() != null && !req.subscriptionPeriod().isBlank()) {
            course.setSubscriptionPeriod(req.subscriptionPeriod().trim().toLowerCase());
        }
    }

    public Course findOrThrow(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));
    }

    private CourseCardResponse toCard(Course c) {
        return new CourseCardResponse(c.getId(), c.getName(), c.getShortDesc(), c.getThumbnail(),
                c.getCategory() != null ? c.getCategory().getName() : null,
                c.getLevel(), c.getDuration(), c.getLanguage(),
                c.getPricingType(), c.getPriceDouble(), c.getCurrency(), c.getSubscriptionPeriod());
    }

    private CourseDetailResponse toDetail(Course c) {
        return new CourseDetailResponse(c.getId(), c.getName(), c.getShortDesc(), c.getDescription(),
                c.getThumbnail(), c.getCategory() != null ? c.getCategory().getId() : null,
                c.getCategory() != null ? c.getCategory().getName() : null,
                c.getLevel(), c.getDuration(), c.getLanguage(), c.getPrerequisites(),
                c.getLearningOutcomes(), c.getStatus().name(), c.getVersion(),
                c.isSequentialVideoEnabled(), c.isRequireVideoCompletion(),
                c.isSequentialLessonUnlocking(), c.isPauseOnTabInactive(),
                c.getVideoCompletionThreshold(), c.getProgressSaveInterval(),
                c.isPendingApproval(), c.getPendingEdits(),
                c.getCreatedAt(), c.getUpdatedAt(),
                c.getPricingType(), c.getPriceDouble(), c.getCurrency(), c.getSubscriptionPeriod());
    }
}

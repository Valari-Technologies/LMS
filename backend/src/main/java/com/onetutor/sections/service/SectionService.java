package com.onetutor.sections.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.sections.dto.SectionRequest;
import com.onetutor.sections.dto.SectionResponse;
import com.onetutor.sections.entity.Section;
import com.onetutor.sections.entity.SectionStatus;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class SectionService {

    private final SectionRepository sectionRepository;
    private final CourseRepository courseRepository;
    private final ContentRepository contentRepository;
    private final AuditService auditService;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public SectionService(SectionRepository sectionRepository,
                           CourseRepository courseRepository,
                           ContentRepository contentRepository,
                           AuditService auditService) {
        this.sectionRepository = sectionRepository;
        this.courseRepository = courseRepository;
        this.contentRepository = contentRepository;
        this.auditService = auditService;
    }

    public List<SectionResponse> listByCourse(Long courseId) {
        return sectionRepository.findByCourseIdOrderByDisplayOrderAsc(courseId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public SectionResponse create(Long courseId, SectionRequest req, User actor) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found"));

        Section section = new Section();
        section.setCourse(course);
        section.setTitle(req.title());
        section.setDescription(req.description());
        section.setDisplayOrder((int) sectionRepository.countByCourseId(courseId));
        if (actor != null && (actor.getRole() == com.onetutor.users.entity.UserRole.content_creator || course.isPendingApproval())) {
            section.setStatus(SectionStatus.pending_approval);
            course.setPendingApproval(true);
            courseRepository.save(course);
        }
        sectionRepository.save(section);

        auditService.log(actor, "SECTION_CREATED", "section", section.getId(),
                "Created section '" + section.getTitle() + "' in course " + courseId);
        return toResponse(section);
    }

    @Transactional
    public SectionResponse update(Long id, SectionRequest req, User actor) {
        Section section = findOrThrow(id);
        section.setTitle(req.title());
        section.setDescription(req.description());
        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator) {
            section.setStatus(SectionStatus.pending_approval);
            if (section.getCourse() != null) {
                section.getCourse().setPendingApproval(true);
                courseRepository.save(section.getCourse());
            }
        }
        sectionRepository.save(section);

        auditService.log(actor, "SECTION_UPDATED", "section", section.getId(),
                "Updated section '" + section.getTitle() + "'");
        return toResponse(section);
    }

    /** Archives or permanently deletes section */
    @Transactional
    public void delete(Long id, boolean force, User actor) {
        Section section = findOrThrow(id);
        if (force) {
            // Nullify section reference on live sessions
            entityManager.createNativeQuery("UPDATE live_sessions SET section_id = NULL WHERE section_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete progress for all contents in this section
            entityManager.createNativeQuery("DELETE FROM progress WHERE content_id IN (SELECT id FROM contents WHERE section_id = :id)")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete content_resources for all contents in this section
            entityManager.createNativeQuery("DELETE FROM content_resources WHERE content_id IN (SELECT id FROM contents WHERE section_id = :id)")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete legacy resources for all contents in this section
            entityManager.createNativeQuery("DELETE FROM resources WHERE content_id IN (SELECT id FROM contents WHERE section_id = :id)")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete contents in this section
            entityManager.createNativeQuery("DELETE FROM contents WHERE section_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete the section
            sectionRepository.delete(section);
            auditService.log(actor, "SECTION_DELETED", "section", id,
                    "Permanently deleted section '" + section.getTitle() + "'");
        } else {
            section.setStatus(SectionStatus.archived);
            sectionRepository.save(section);
            auditService.log(actor, "SECTION_ARCHIVED", "section", id,
                    "Archived section '" + section.getTitle() + "'");
        }

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator && section.getCourse() != null) {
            section.getCourse().setPendingApproval(true);
            courseRepository.save(section.getCourse());
        }
    }

    @Transactional
    public void archive(Long id, User actor) {
        delete(id, false, actor);
    }

    @Transactional
    public void restore(Long id, User actor) {
        Section section = findOrThrow(id);
        section.setStatus(SectionStatus.active);
        sectionRepository.save(section);

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator && section.getCourse() != null) {
            section.getCourse().setPendingApproval(true);
            courseRepository.save(section.getCourse());
        }

        auditService.log(actor, "SECTION_RESTORED", "section", id,
                "Restored section '" + section.getTitle() + "'");
    }

    @Transactional
    public void reorder(Long courseId, List<Long> orderedIds, User actor) {
        List<Section> sections = sectionRepository.findByCourseIdOrderByDisplayOrderAsc(courseId);
        for (Section s : sections) {
            if (!orderedIds.contains(s.getId())) {
                throw new BadRequestException("INVALID_REORDER", "Reorder list is missing section id " + s.getId());
            }
        }
        for (int i = 0; i < orderedIds.size(); i++) {
            Long id = orderedIds.get(i);
            Section section = sections.stream().filter(s -> s.getId().equals(id)).findFirst()
                    .orElseThrow(() -> new BadRequestException("INVALID_REORDER", "Section " + id + " does not belong to this course"));
            section.setDisplayOrder(i);
        }
        sectionRepository.saveAll(sections);

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator) {
            courseRepository.findById(courseId).ifPresent(c -> {
                c.setPendingApproval(true);
                courseRepository.save(c);
            });
        }

        auditService.log(actor, "SECTIONS_REORDERED", "course", courseId, "Reordered sections");
    }

    public Section findOrThrow(Long id) {
        return sectionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SECTION_NOT_FOUND", "Section not found"));
    }

    private SectionResponse toResponse(Section s) {
        int contentCount = (int) contentRepository.countBySectionId(s.getId());
        return new SectionResponse(s.getId(), s.getCourse().getId(), s.getTitle(),
                s.getDescription(), s.getDisplayOrder(), s.getStatus().name(), contentCount, s.getCreatedAt());
    }
}

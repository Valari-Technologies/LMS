package com.onetutor.contents.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.dto.*;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.entity.ContentResource;
import com.onetutor.contents.entity.ContentStatus;
import com.onetutor.contents.entity.ContentType;
import com.onetutor.contents.entity.Resource;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.contents.repository.ContentResourceRepository;
import com.onetutor.contents.repository.ResourceRepository;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.media.repository.MediaAssetRepository;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.sections.entity.Section;
import com.onetutor.sections.repository.SectionRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ContentService {

    private final ContentRepository contentRepository;
    private final ResourceRepository resourceRepository;
    private final ContentResourceRepository contentResourceRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final SectionRepository sectionRepository;
    private final CourseRepository courseRepository;
    private final AuditService auditService;
    private final com.onetutor.subtitles.service.SubtitleService subtitleService;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public ContentService(ContentRepository contentRepository,
                           ResourceRepository resourceRepository,
                           ContentResourceRepository contentResourceRepository,
                           MediaAssetRepository mediaAssetRepository,
                           SectionRepository sectionRepository,
                           CourseRepository courseRepository,
                           AuditService auditService,
                           @org.springframework.context.annotation.Lazy com.onetutor.subtitles.service.SubtitleService subtitleService) {
        this.contentRepository = contentRepository;
        this.resourceRepository = resourceRepository;
        this.contentResourceRepository = contentResourceRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.sectionRepository = sectionRepository;
        this.courseRepository = courseRepository;
        this.auditService = auditService;
        this.subtitleService = subtitleService;
    }

    public List<ContentResponse> listBySection(Long sectionId) {
        return contentRepository.findBySectionIdOrderByDisplayOrderAsc(sectionId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ContentResponse create(Long sectionId, ContentRequest req, User actor) {
        Section section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new NotFoundException("SECTION_NOT_FOUND", "Section not found"));

        Content content = new Content();
        content.setSection(section);
        applyRequest(content, req);
        content.setDisplayOrder((int) contentRepository.countBySectionId(sectionId));
        boolean isPending = (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator) || (section.getCourse() != null && section.getCourse().isPendingApproval());
        if (isPending) {
            content.setStatus(ContentStatus.pending_approval);
            if (section.getCourse() != null) {
                section.getCourse().setPendingApproval(true);
                courseRepository.save(section.getCourse());
            }
        }
        contentRepository.save(content);

        if (content.getContentType() == ContentType.VIDEO || isVideoMedia(content.getMediaReference())) {
            try {
                subtitleService.processSubtitlesAsync(content.getId());
            } catch (Exception ignored) {}
        }

        auditService.log(actor, "CONTENT_CREATED", "content", content.getId(),
                "Created content '" + content.getTitle() + "' in section " + sectionId);
        return toResponse(content);
    }

    @Transactional
    public ContentResponse update(Long id, ContentRequest req, User actor) {
        Content content = findOrThrow(id);
        applyRequest(content, req);
        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator) {
            content.setStatus(ContentStatus.pending_approval);
            if (content.getSection() != null && content.getSection().getCourse() != null) {
                content.getSection().getCourse().setPendingApproval(true);
                courseRepository.save(content.getSection().getCourse());
            }
        }
        contentRepository.save(content);

        if (content.getContentType() == ContentType.VIDEO || isVideoMedia(content.getMediaReference())) {
            try {
                subtitleService.processSubtitlesAsync(content.getId());
            } catch (Exception ignored) {}
        }

        auditService.log(actor, "CONTENT_UPDATED", "content", content.getId(),
                "Updated content '" + content.getTitle() + "'");
        return toResponse(content);
    }

    @Transactional
    public void delete(Long id, boolean force, User actor) {
        Content content = findOrThrow(id);
        if (force) {
            // Delete student progress referencing this content
            entityManager.createNativeQuery("DELETE FROM progress WHERE content_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete content_resources referencing this content
            entityManager.createNativeQuery("DELETE FROM content_resources WHERE content_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete legacy resources referencing this content
            entityManager.createNativeQuery("DELETE FROM resources WHERE content_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            // Delete the content record
            contentRepository.delete(content);
            auditService.log(actor, "CONTENT_DELETED", "content", id,
                    "Permanently deleted content '" + content.getTitle() + "'");
        } else {
            content.setStatus(ContentStatus.archived);
            contentRepository.save(content);
            auditService.log(actor, "CONTENT_ARCHIVED", "content", id,
                    "Archived content '" + content.getTitle() + "'");
        }

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator && content.getSection() != null && content.getSection().getCourse() != null) {
            content.getSection().getCourse().setPendingApproval(true);
            courseRepository.save(content.getSection().getCourse());
        }
    }

    @Transactional
    public void archive(Long id, User actor) {
        delete(id, false, actor);
    }

    @Transactional
    public void restore(Long id, User actor) {
        Content content = findOrThrow(id);
        content.setStatus(ContentStatus.active);
        contentRepository.save(content);

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator && content.getSection() != null && content.getSection().getCourse() != null) {
            content.getSection().getCourse().setPendingApproval(true);
            courseRepository.save(content.getSection().getCourse());
        }

        auditService.log(actor, "CONTENT_RESTORED", "content", id,
                "Restored content '" + content.getTitle() + "'");
    }

    @Transactional
    public void reorder(Long sectionId, List<Long> orderedIds, User actor) {
        List<Content> contents = contentRepository.findBySectionIdOrderByDisplayOrderAsc(sectionId);
        for (Content c : contents) {
            if (!orderedIds.contains(c.getId())) {
                throw new BadRequestException("INVALID_REORDER", "Reorder list is missing content id " + c.getId());
            }
        }
        for (int i = 0; i < orderedIds.size(); i++) {
            Long id = orderedIds.get(i);
            Content content = contents.stream().filter(c -> c.getId().equals(id)).findFirst()
                    .orElseThrow(() -> new BadRequestException("INVALID_REORDER", "Content " + id + " does not belong to this section"));
            content.setDisplayOrder(i);
        }
        contentRepository.saveAll(contents);

        if (actor != null && actor.getRole() == com.onetutor.users.entity.UserRole.content_creator && !contents.isEmpty() && contents.get(0).getSection() != null && contents.get(0).getSection().getCourse() != null) {
            contents.get(0).getSection().getCourse().setPendingApproval(true);
            courseRepository.save(contents.get(0).getSection().getCourse());
        }

        auditService.log(actor, "CONTENT_REORDERED", "section", sectionId, "Reordered contents");
    }

    @Transactional
    public ResourceResponse addResource(Long contentId, ResourceRequest req, User actor) {
        Content content = findOrThrow(contentId);
        Resource resource = new Resource();
        resource.setContent(content);
        resource.setType(req.type());
        resource.setName(req.name());
        resource.setUrl(req.url());
        resource.setDisplayOrder((int) resourceRepository.findByContentIdOrderByDisplayOrderAsc(contentId).size());
        resourceRepository.save(resource);

        // Also mirror into content_resources table
        ContentResource cr = new ContentResource();
        cr.setContent(content);
        cr.setResourceType("link".equalsIgnoreCase(req.type()) ? "link" : "file");
        cr.setTitle(req.name());
        cr.setDescription(req.url());
        cr.setDisplayOrder(resource.getDisplayOrder());
        contentResourceRepository.save(cr);

        auditService.log(actor, "RESOURCE_ADDED", "content", contentId, "Added resource '" + req.name() + "'");
        return toResourceResponse(resource);
    }

    public List<ResourceResponse> listResources(Long contentId) {
        return resourceRepository.findByContentIdOrderByDisplayOrderAsc(contentId)
                .stream().map(this::toResourceResponse).toList();
    }

    public List<ResourceResponse> listResourcesByCourse(Long courseId) {
        return resourceRepository.findByCourseId(courseId)
                .stream().map(this::toResourceResponse).toList();
    }

    @Transactional
    public ResourceResponse updateResource(Long resourceId, ResourceRequest req, User actor) {
        Resource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new NotFoundException("RESOURCE_NOT_FOUND", "Resource not found"));

        String oldName = resource.getName();
        String oldUrl = resource.getUrl();

        if (req.type() != null && !req.type().isBlank()) resource.setType(req.type());
        if (req.name() != null && !req.name().isBlank()) resource.setName(req.name());
        if (req.url() != null && !req.url().isBlank()) resource.setUrl(req.url());

        resourceRepository.save(resource);

        // Sync mirrored ContentResource if present
        if (resource.getContent() != null) {
            List<ContentResource> crList = contentResourceRepository.findByContentIdOrderByDisplayOrderAsc(resource.getContent().getId());
            for (ContentResource cr : crList) {
                if ((oldName != null && oldName.equals(cr.getTitle())) || (oldUrl != null && oldUrl.equals(cr.getDescription()))) {
                    cr.setTitle(resource.getName());
                    cr.setDescription(resource.getUrl());
                    cr.setResourceType("link".equalsIgnoreCase(resource.getType()) ? "link" : "file");
                    contentResourceRepository.save(cr);
                    break;
                }
            }
        }

        auditService.log(actor, "RESOURCE_UPDATED", "resource", resourceId, "Updated resource '" + resource.getName() + "'");
        return toResourceResponse(resource);
    }

    @Transactional
    public void deleteResource(Long resourceId, User actor) {
        Resource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new NotFoundException("RESOURCE_NOT_FOUND", "Resource not found"));

        String name = resource.getName();
        String url = resource.getUrl();
        Long contentId = resource.getContent() != null ? resource.getContent().getId() : null;

        resourceRepository.delete(resource);

        // Sync mirrored ContentResource if present
        if (contentId != null) {
            List<ContentResource> crList = contentResourceRepository.findByContentIdOrderByDisplayOrderAsc(contentId);
            for (ContentResource cr : crList) {
                if ((name != null && name.equals(cr.getTitle())) || (url != null && url.equals(cr.getDescription()))) {
                    contentResourceRepository.delete(cr);
                    break;
                }
            }
        }

        auditService.log(actor, "RESOURCE_DELETED", "resource", resourceId, "Deleted resource '" + name + "'");
    }

    public List<ContentResourceResponse> listContentResources(Long contentId) {
        return contentResourceRepository.findByContentIdOrderByDisplayOrderAsc(contentId)
                .stream().map(ContentResourceResponse::from).toList();
    }

    @Transactional
    public ContentResourceResponse addContentResource(Long contentId, ContentResourceRequest req, User actor) {
        Content content = findOrThrow(contentId);
        ContentResource cr = new ContentResource();
        cr.setContent(content);

        if (req.mediaAssetId() != null) {
            MediaAsset asset = mediaAssetRepository.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
            cr.setMediaAsset(asset);
        }
        cr.setResourceType(req.resourceType() != null && !req.resourceType().isBlank() ? req.resourceType().toLowerCase() : "file");
        cr.setTitle(req.title());
        cr.setDescription(req.description());
        int count = contentResourceRepository.findByContentIdOrderByDisplayOrderAsc(contentId).size();
        cr.setDisplayOrder(req.displayOrder() != null ? req.displayOrder() : count);

        contentResourceRepository.save(cr);

        auditService.log(actor, "CONTENT_RESOURCE_ADDED", "content", contentId,
                "Added content resource '" + cr.getTitle() + "' to content " + contentId);
        return ContentResourceResponse.from(cr);
    }

    @Transactional
    public ContentResourceResponse updateContentResource(Long resourceId, ContentResourceRequest req, User actor) {
        ContentResource cr = contentResourceRepository.findById(resourceId)
                .orElseThrow(() -> new NotFoundException("RESOURCE_NOT_FOUND", "Content resource not found"));

        if (req.mediaAssetId() != null) {
            MediaAsset asset = mediaAssetRepository.findById(req.mediaAssetId())
                    .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
            cr.setMediaAsset(asset);
        }
        if (req.resourceType() != null) cr.setResourceType(req.resourceType().toLowerCase());
        if (req.title() != null) cr.setTitle(req.title());
        if (req.description() != null) cr.setDescription(req.description());
        if (req.displayOrder() != null) cr.setDisplayOrder(req.displayOrder());

        contentResourceRepository.save(cr);

        auditService.log(actor, "CONTENT_RESOURCE_UPDATED", "content_resource", resourceId,
                "Updated content resource " + resourceId);
        return ContentResourceResponse.from(cr);
    }

    @Transactional
    public void deleteContentResource(Long resourceId, User actor) {
        ContentResource cr = contentResourceRepository.findById(resourceId)
                .orElseThrow(() -> new NotFoundException("RESOURCE_NOT_FOUND", "Content resource not found"));
        contentResourceRepository.delete(cr);
        auditService.log(actor, "CONTENT_RESOURCE_DELETED", "content_resource", resourceId,
                "Deleted content resource " + resourceId);
    }

    private void applyRequest(Content content, ContentRequest req) {
        ContentType type;
        try {
            type = ContentType.valueOf(req.contentType().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("INVALID_CONTENT_TYPE",
                    "contentType must be one of VIDEO, PDF, IMAGE, DOWNLOAD, EXTERNAL_LINK, LINK, RESOURCE");
        }
        content.setTitle(req.title());
        content.setDescription(req.description());
        content.setContentType(type);
        content.setMediaReference(req.mediaReference());
        content.setCompletionRule(req.completionRule() != null ? req.completionRule() : "DEFAULT");
    }

    public Content findOrThrow(Long id) {
        return contentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("CONTENT_NOT_FOUND", "Content not found"));
    }

    public ContentResponse toResponse(Content c) {
        List<ResourceResponse> resources = resourceRepository.findByContentIdOrderByDisplayOrderAsc(c.getId())
                .stream().map(this::toResourceResponse).toList();
        List<ContentResourceResponse> contentResources = contentResourceRepository.findByContentIdOrderByDisplayOrderAsc(c.getId())
                .stream().map(ContentResourceResponse::from).toList();
        return new ContentResponse(
                c.getId(), c.getSection().getId(), c.getTitle(), c.getDescription(),
                c.getContentType().name(), c.getMediaReference(), c.getDisplayOrder(),
                c.getCompletionRule(), c.getStatus().name(), resources, contentResources, c.getCreatedAt(),
                c.getSubtitleUrl(),
                c.getSubtitleStatus() != null ? c.getSubtitleStatus().name() : "PENDING",
                c.getSubtitleLanguage() != null ? c.getSubtitleLanguage() : "en",
                c.getSubtitleSourceLanguage(),
                c.getSubtitleGeneratedAt(),
                c.getSubtitleError(),
                c.getSubtitleProgress()
        );
    }

    private ResourceResponse toResourceResponse(Resource r) {
        return new ResourceResponse(r.getId(), r.getType(), r.getName(), r.getUrl(), r.getDisplayOrder());
    }

    private boolean isVideoMedia(String ref) {
        if (ref == null) return false;
        String lower = ref.toLowerCase();
        return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.contains("/media/files/");
    }
}

package com.onetutor.categories.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.categories.dto.CategoryRequest;
import com.onetutor.categories.dto.CategoryResponse;
import com.onetutor.categories.entity.Category;
import com.onetutor.categories.entity.CategoryStatus;
import com.onetutor.categories.repository.CategoryRepository;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final AuditService auditService;

    public CategoryService(CategoryRepository categoryRepository, AuditService auditService) {
        this.categoryRepository = categoryRepository;
        this.auditService = auditService;
    }

    /** Public listing — defaults to active-only categories (archived are hidden from students). */
    public PageResponse<CategoryResponse> list(String search, Pageable pageable) {
        return list(search, null, false, pageable);
    }

    /**
     * Lists categories with optional status filter or includeArchived flag (for admin view).
     */
    public PageResponse<CategoryResponse> list(String search, String status, Boolean includeArchived, Pageable pageable) {
        boolean hasSearch = (search != null && !search.isBlank());
        String cleanSearch = hasSearch ? search.trim() : null;

        boolean showAll = Boolean.TRUE.equals(includeArchived) || "all".equalsIgnoreCase(status);

        Page<Category> page;
        if (showAll) {
            page = hasSearch
                    ? categoryRepository.findByNameContainingIgnoreCase(cleanSearch, pageable)
                    : categoryRepository.findAll(pageable);
        } else {
            CategoryStatus catStatus = CategoryStatus.active;
            if (status != null && !status.isBlank()) {
                try {
                    catStatus = CategoryStatus.valueOf(status.toLowerCase());
                } catch (IllegalArgumentException ignored) {
                    catStatus = CategoryStatus.active;
                }
            }
            page = hasSearch
                    ? categoryRepository.findByStatusAndNameContainingIgnoreCase(catStatus, cleanSearch, pageable)
                    : categoryRepository.findByStatus(catStatus, pageable);
        }
        return PageResponse.from(page.map(this::toResponse));
    }


    public CategoryResponse get(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional
    public CategoryResponse create(CategoryRequest req, User actor) {
        Category category = new Category();
        category.setName(req.name());
        category.setDescription(req.description());
        category.setStatus(CategoryStatus.active);
        categoryRepository.save(category);

        auditService.log(actor, "CATEGORY_CREATED", "category", category.getId(),
                "Created category '" + category.getName() + "'");
        return toResponse(category);
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest req, User actor) {
        Category category = findOrThrow(id);
        category.setName(req.name());
        category.setDescription(req.description());
        categoryRepository.save(category);

        auditService.log(actor, "CATEGORY_UPDATED", "category", category.getId(),
                "Updated category '" + category.getName() + "'");
        return toResponse(category);
    }

    @Transactional
    public CategoryResponse archive(Long id, User actor) {
        Category category = findOrThrow(id);
        category.setStatus(CategoryStatus.archived);
        categoryRepository.save(category);

        auditService.log(actor, "CATEGORY_ARCHIVED", "category", category.getId(),
                "Archived category '" + category.getName() + "'");
        return toResponse(category);
    }

    @Transactional
    public CategoryResponse unarchive(Long id, User actor) {
        Category category = findOrThrow(id);
        category.setStatus(CategoryStatus.active);
        categoryRepository.save(category);

        auditService.log(actor, "CATEGORY_UNARCHIVED", "category", category.getId(),
                "Unarchived category '" + category.getName() + "'");
        return toResponse(category);
    }

    /**
     * Enforces SRS section 30: archived categories should not be selectable
     * for new published courses. Called by CourseService on create/update/publish.
     */
    public Category assertSelectable(Long categoryId) {
        Category category = findOrThrow(categoryId);
        if (category.getStatus() == CategoryStatus.archived) {
            throw new BadRequestException("CATEGORY_ARCHIVED",
                    "Cannot assign an archived category to a course");
        }
        return category;
    }

    public Category findOrThrow(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("CATEGORY_NOT_FOUND", "Category not found"));
    }

    private CategoryResponse toResponse(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(),
                c.getStatus().name(), c.getCreatedAt(), c.getUpdatedAt());
    }
}

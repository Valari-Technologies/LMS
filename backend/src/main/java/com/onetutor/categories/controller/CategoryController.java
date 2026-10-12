package com.onetutor.categories.controller;

import com.onetutor.categories.dto.CategoryRequest;
import com.onetutor.categories.dto.CategoryResponse;
import com.onetutor.categories.service.CategoryService;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * GET endpoints are public (browsing categories requires no auth — see
 * SecurityConfig). Mutations require ROLE_ADMIN, enforced both at the URL
 * level (SecurityConfig: only GET is permitAll on this path... actually
 * this path isn't under /admin/**, so method security is applied here).
 */
@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ApiResponse<PageResponse<CategoryResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean includeArchived) {
        return ApiResponse.ok(categoryService.list(search, status, includeArchived, PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<CategoryResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(categoryService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CategoryResponse> create(@Valid @RequestBody CategoryRequest req,
                                                 @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Category created successfully", categoryService.create(req, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CategoryResponse> update(@PathVariable Long id,
                                                 @Valid @RequestBody CategoryRequest req,
                                                 @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Category updated successfully", categoryService.update(id, req, actor));
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CategoryResponse> archive(@PathVariable Long id,
                                                  @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Category archived successfully", categoryService.archive(id, actor));
    }

    @PostMapping("/{id}/unarchive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<CategoryResponse> unarchive(@PathVariable Long id,
                                                     @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Category unarchived successfully", categoryService.unarchive(id, actor));
    }
}

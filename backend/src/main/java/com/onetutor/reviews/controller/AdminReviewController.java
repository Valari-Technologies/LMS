package com.onetutor.reviews.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.reviews.dto.AdminReviewStats;
import com.onetutor.reviews.dto.ReviewResponse;
import com.onetutor.reviews.service.CourseReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/reviews")
@RequiredArgsConstructor
@Tag(name = "Admin Reviews & Ratings", description = "Course review and rating moderation for Super Admin and Administrators")
public class AdminReviewController {

    private final CourseReviewService reviewService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'READONLY_ADMIN')")
    @Operation(summary = "List all student course reviews with filtering by course, rating, status, student ID/name search")
    public ApiResponse<PageResponse<ReviewResponse>> listReviews(
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        Page<ReviewResponse> result = reviewService.adminGetReviews(courseId, rating, status, search, pageable);
        return ApiResponse.ok(PageResponse.from(result));
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Publish or unpublish a student review")
    public ApiResponse<ReviewResponse> togglePublish(
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean publish) {
        ReviewResponse updated = reviewService.adminPublishReview(id, publish);
        return ApiResponse.ok(publish ? "Review published successfully" : "Review moved to pending approval", updated);
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'READONLY_ADMIN')")
    @Operation(summary = "Get platform-wide review statistics and KPIs")
    public ApiResponse<AdminReviewStats> getStats() {
        return ApiResponse.ok(reviewService.adminGetStats());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Delete / moderate a student review")
    public ApiResponse<Void> deleteReview(@PathVariable Long id) {
        reviewService.adminDeleteReview(id);
        return ApiResponse.ok("Review removed successfully", null);
    }
}

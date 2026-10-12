package com.onetutor.reviews.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.reviews.dto.CourseRatingSummary;
import com.onetutor.reviews.dto.ReviewRequest;
import com.onetutor.reviews.dto.ReviewResponse;
import com.onetutor.reviews.service.CourseReviewService;
import com.onetutor.users.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/courses/{courseId}/reviews")
@RequiredArgsConstructor
@Tag(name = "Course Reviews", description = "Endpoints for students to rate and comment on courses")
public class CourseReviewController {

    private final CourseReviewService reviewService;

    @GetMapping
    @Operation(summary = "Get paginated reviews for a course")
    public ApiResponse<PageResponse<ReviewResponse>> getReviews(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal User user) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50)));
        Page<ReviewResponse> result = reviewService.getReviewsForCourse(courseId, pageable, user != null ? user.getId() : null);
        return ApiResponse.ok(PageResponse.from(result));
    }

    @GetMapping("/summary")
    @Operation(summary = "Get rating summary and star distribution for a course")
    public ApiResponse<CourseRatingSummary> getSummary(@PathVariable Long courseId) {
        return ApiResponse.ok(reviewService.getCourseRatingSummary(courseId));
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get current authenticated student's review for this course")
    public ApiResponse<ReviewResponse> getMyReview(
            @PathVariable Long courseId,
            @AuthenticationPrincipal User user) {
        return ApiResponse.ok(reviewService.getMyReview(courseId, user));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit or update rating and comment for a course")
    public ResponseEntity<ApiResponse<ReviewResponse>> submitReview(
            @PathVariable Long courseId,
            @Valid @RequestBody ReviewRequest req,
            @AuthenticationPrincipal User user) {
        ReviewResponse response = reviewService.submitOrUpdateReview(courseId, req, user);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Review submitted successfully", response));
    }

    @DeleteMapping("/my")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Delete current authenticated student's review for this course")
    public ApiResponse<Void> deleteMyReview(
            @PathVariable Long courseId,
            @AuthenticationPrincipal User user) {
        reviewService.deleteMyReview(courseId, user);
        return ApiResponse.ok("Review deleted successfully", null);
    }
}

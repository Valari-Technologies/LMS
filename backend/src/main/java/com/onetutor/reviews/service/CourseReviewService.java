package com.onetutor.reviews.service;

import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import com.onetutor.enrollment.repository.EnrollmentRepository;
import com.onetutor.reviews.dto.AdminReviewStats;
import com.onetutor.reviews.dto.CourseRatingSummary;
import com.onetutor.reviews.dto.ReviewRequest;
import com.onetutor.reviews.dto.ReviewResponse;
import com.onetutor.reviews.entity.CourseReview;
import com.onetutor.reviews.repository.CourseReviewRepository;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CourseReviewService {

    private final CourseReviewRepository reviewRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Transactional
    public ReviewResponse submitOrUpdateReview(Long courseId, ReviewRequest req, User user) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NotFoundException("Course not found with id: " + courseId));

        boolean isEnrolled = enrollmentRepository.findByStudentIdAndCourseId(user.getId(), courseId)
                .map(e -> e.getStatus() == EnrollmentStatus.active)
                .orElse(false);

        boolean isAdmin = user.getRole() == UserRole.admin || user.getRole() == UserRole.super_admin;

        if (!isEnrolled && !isAdmin) {
            throw new ForbiddenException("NOT_ENROLLED", "Only enrolled students can rate or review this course.");
        }

        CourseReview review = reviewRepository.findByCourseIdAndUserId(courseId, user.getId())
                .orElseGet(() -> {
                    CourseReview newReview = new CourseReview();
                    newReview.setCourse(course);
                    newReview.setUser(user);
                    return newReview;
                });

        review.setRating(req.rating());
        String newComment = req.comment() != null && !req.comment().trim().isEmpty() ? req.comment().trim() : null;
        if (newComment != null) {
            // New or modified comment starts in pending approval status
            if (!newComment.equals(review.getComment())) {
                review.setComment(newComment);
                review.setStatus("pending");
            }
        } else {
            review.setComment(null);
            review.setStatus("published");
        }

        CourseReview saved = reviewRepository.save(review);
        return toResponse(saved, user.getId(), false);
    }

    @Transactional(readOnly = true)
    public ReviewResponse getMyReview(Long courseId, User user) {
        if (user == null) return null;
        return reviewRepository.findByCourseIdAndUserId(courseId, user.getId())
                .map(r -> toResponse(r, user.getId(), false))
                .orElse(null);
    }

    @Transactional
    public void deleteMyReview(Long courseId, User user) {
        CourseReview review = reviewRepository.findByCourseIdAndUserId(courseId, user.getId())
                .orElseThrow(() -> new NotFoundException("You have not reviewed this course"));
        reviewRepository.delete(review);
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> getReviewsForCourse(Long courseId, Pageable pageable, Long currentUserId) {
        // Return all reviews for this course directly so star ratings appear immediately
        return reviewRepository.findByCourseIdOrderByCreatedAtDesc(courseId, pageable)
                .map(r -> toResponse(r, currentUserId, false));
    }

    @Transactional(readOnly = true)
    public CourseRatingSummary getCourseRatingSummary(Long courseId) {
        Long total = reviewRepository.countByCourseId(courseId);
        Double rawAvg = reviewRepository.getAverageRatingForCourse(courseId);
        double roundedAvg = 0.0;
        if (rawAvg != null && total > 0) {
            roundedAvg = BigDecimal.valueOf(rawAvg).setScale(1, RoundingMode.HALF_UP).doubleValue();
        }

        Map<Integer, Long> dist = new HashMap<>();
        for (int i = 1; i <= 5; i++) {
            dist.put(i, 0L);
        }
        List<Object[]> distributionData = reviewRepository.getRatingDistributionForCourse(courseId);
        for (Object[] row : distributionData) {
            if (row != null && row.length >= 2) {
                Integer star = ((Number) row[0]).intValue();
                Long count = ((Number) row[1]).longValue();
                dist.put(star, count);
            }
        }

        return new CourseRatingSummary(courseId, roundedAvg, total, dist);
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> adminGetReviews(Long courseId, Integer rating, String status, String search, Pageable pageable) {
        Specification<CourseReview> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Fetch join user and course when not a count query
            if (query != null && Long.class != query.getResultType() && long.class != query.getResultType()) {
                root.fetch("user", JoinType.LEFT);
                root.fetch("course", JoinType.LEFT);
            }

            if (courseId != null) {
                predicates.add(cb.equal(root.get("course").get("id"), courseId));
            }

            if (rating != null) {
                predicates.add(cb.equal(root.get("rating"), rating));
            }

            if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase()));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Join<CourseReview, User> userJoin = root.join("user", JoinType.LEFT);
                Join<CourseReview, Course> courseJoin = root.join("course", JoinType.LEFT);

                Predicate userName = cb.like(cb.lower(userJoin.get("name")), pattern);
                Predicate userEmail = cb.like(cb.lower(userJoin.get("email")), pattern);
                Predicate courseName = cb.like(cb.lower(courseJoin.get("name")), pattern);
                Predicate comment = cb.like(cb.lower(root.get("comment")), pattern);

                predicates.add(cb.or(userName, userEmail, courseName, comment));
            }

            if (query != null) {
                query.orderBy(cb.desc(root.get("createdAt")));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return reviewRepository.findAll(spec, pageable)
                .map(r -> toResponse(r, null, true));
    }

    @Transactional
    public ReviewResponse adminPublishReview(Long reviewId, boolean publish) {
        CourseReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("Review not found with id: " + reviewId));
        review.setStatus(publish ? "published" : "pending");
        CourseReview saved = reviewRepository.save(review);
        return toResponse(saved, null, true);
    }

    @Transactional(readOnly = true)
    public AdminReviewStats adminGetStats() {
        long total = reviewRepository.count();
        Double rawAvg = reviewRepository.getOverallAverageRating();
        double roundedAvg = 0.0;
        if (rawAvg != null && total > 0) {
            roundedAvg = BigDecimal.valueOf(rawAvg).setScale(1, RoundingMode.HALF_UP).doubleValue();
        }
        long fiveStar = reviewRepository.countFiveStarReviews();
        long uniqueStudents = reviewRepository.countDistinctUsers();
        long uniqueCourses = reviewRepository.countDistinctCourses();
        long pendingCount = reviewRepository.countPendingReviews();

        return new AdminReviewStats(total, roundedAvg, fiveStar, uniqueStudents, uniqueCourses, pendingCount);
    }

    @Transactional
    public void adminDeleteReview(Long reviewId) {
        CourseReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("Review not found with id: " + reviewId));
        reviewRepository.delete(review);
    }

    private ReviewResponse toResponse(CourseReview review, Long currentUserId, boolean isAdmin) {
        User u = review.getUser();
        Course c = review.getCourse();
        boolean canEdit = currentUserId != null && u != null && currentUserId.equals(u.getId());
        boolean isOwner = canEdit;

        // If comment is pending, only the author or an admin can see the comment text.
        // Other students see the star rating directly, while comment text awaits Super Admin approval.
        String commentText = review.getComment();
        if ("pending".equalsIgnoreCase(review.getStatus()) && !isOwner && !isAdmin) {
            commentText = null;
        }

        return new ReviewResponse(
                review.getId(),
                c != null ? c.getId() : null,
                c != null ? c.getName() : "Unknown Course",
                u != null ? u.getId() : null,
                u != null ? u.getName() : "Anonymous Student",
                u != null ? u.getEmail() : null,
                u != null ? u.getProfileImage() : null,
                review.getRating(),
                commentText,
                review.getStatus() != null ? review.getStatus() : "published",
                review.getCreatedAt(),
                review.getUpdatedAt(),
                canEdit
        );
    }
}

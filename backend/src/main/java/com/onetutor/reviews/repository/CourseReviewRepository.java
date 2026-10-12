package com.onetutor.reviews.repository;

import com.onetutor.reviews.entity.CourseReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseReviewRepository extends JpaRepository<CourseReview, Long>, JpaSpecificationExecutor<CourseReview> {

    Optional<CourseReview> findByCourseIdAndUserId(Long courseId, Long userId);

    boolean existsByCourseIdAndUserId(Long courseId, Long userId);

    @Query("SELECT r FROM CourseReview r JOIN FETCH r.user u WHERE r.course.id = :courseId AND r.status = 'published' AND r.comment IS NOT NULL AND TRIM(r.comment) <> '' ORDER BY r.createdAt DESC")
    Page<CourseReview> findByCourseIdOrderByCreatedAtDesc(@Param("courseId") Long courseId, Pageable pageable);

    @Query("SELECT AVG(r.rating) FROM CourseReview r WHERE r.course.id = :courseId")
    Double getAverageRatingForCourse(@Param("courseId") Long courseId);

    @Query("SELECT COUNT(r) FROM CourseReview r WHERE r.course.id = :courseId")
    Long countByCourseId(@Param("courseId") Long courseId);

    @Query("SELECT r.rating, COUNT(r) FROM CourseReview r WHERE r.course.id = :courseId GROUP BY r.rating")
    List<Object[]> getRatingDistributionForCourse(@Param("courseId") Long courseId);

    @Query("SELECT AVG(r.rating) FROM CourseReview r")
    Double getOverallAverageRating();

    @Query("SELECT COUNT(r) FROM CourseReview r WHERE r.rating = 5")
    Long countFiveStarReviews();

    @Query("SELECT COUNT(DISTINCT r.user.id) FROM CourseReview r")
    Long countDistinctUsers();

    @Query("SELECT COUNT(DISTINCT r.course.id) FROM CourseReview r")
    Long countDistinctCourses();

    @Query("SELECT COUNT(r) FROM CourseReview r WHERE r.status = 'pending' AND r.comment IS NOT NULL AND TRIM(r.comment) <> ''")
    Long countPendingReviews();
}

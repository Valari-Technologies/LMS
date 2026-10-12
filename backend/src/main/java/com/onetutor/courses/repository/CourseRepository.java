package com.onetutor.courses.repository;

import com.onetutor.courses.entity.Course;
import com.onetutor.courses.entity.CourseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, Long> {

    Page<Course> findByStatus(CourseStatus status, Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.status = com.onetutor.courses.entity.CourseStatus.published")
    Page<Course> findPublished(Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.status = com.onetutor.courses.entity.CourseStatus.published AND c.category.id = :categoryId")
    Page<Course> findPublishedByCategory(@Param("categoryId") Long categoryId, Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.status = com.onetutor.courses.entity.CourseStatus.published AND (" +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.description) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.shortDesc) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Course> searchPublishedByText(@Param("search") String search, Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.status = com.onetutor.courses.entity.CourseStatus.published AND c.category.id = :categoryId AND (" +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.description) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.shortDesc) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Course> searchPublishedByCategoryAndText(@Param("categoryId") Long categoryId,
                                                  @Param("search") String search,
                                                  Pageable pageable);

    long countByStatus(CourseStatus status);
}

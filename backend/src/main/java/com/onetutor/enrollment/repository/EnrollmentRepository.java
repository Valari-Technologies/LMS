package com.onetutor.enrollment.repository;

import com.onetutor.admin.dto.CourseEnrollmentStatResponse;
import com.onetutor.enrollment.entity.Enrollment;
import com.onetutor.enrollment.entity.EnrollmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    Optional<Enrollment> findByStudentIdAndCourseId(Long studentId, Long courseId);

    Optional<Enrollment> findByStudentIdAndCourseIdAndStatus(Long studentId, Long courseId, EnrollmentStatus status);

    Page<Enrollment> findByStudentIdAndStatus(Long studentId, EnrollmentStatus status, Pageable pageable);

    Page<Enrollment> findByCourseId(Long courseId, Pageable pageable);

    @Query("SELECT e.student FROM Enrollment e WHERE e.course.id = :courseId AND e.status = com.onetutor.enrollment.entity.EnrollmentStatus.active")
    List<com.onetutor.users.entity.User> findActiveStudentsByCourseId(@Param("courseId") Long courseId);

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.student WHERE e.course.id = :courseId AND e.status = com.onetutor.enrollment.entity.EnrollmentStatus.active")
    List<Enrollment> findActiveEnrollmentsWithStudentByCourseId(@Param("courseId") Long courseId);


    @Query("SELECT e.student FROM Enrollment e WHERE e.batch.id = :batchId AND e.status = com.onetutor.enrollment.entity.EnrollmentStatus.active")
    List<com.onetutor.users.entity.User> findActiveStudentsByBatchId(@Param("batchId") Long batchId);

    Page<Enrollment> findByStudentId(Long studentId, Pageable pageable);

    List<Enrollment> findByStudentId(Long studentId);

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.course " +
           "WHERE e.student.id = :studentId AND e.status = :status")
    List<Enrollment> findAllByStudentIdAndStatusWithCourse(@Param("studentId") Long studentId,
                                                           @Param("status") EnrollmentStatus status);

    long countByStatus(EnrollmentStatus status);

    long countByCourseIdAndStatus(Long courseId, EnrollmentStatus status);

    long countByBatchIdAndStatus(Long batchId, EnrollmentStatus status);

    Page<Enrollment> findByBatchId(Long batchId, Pageable pageable);

    Page<Enrollment> findByBatchIdAndStatus(Long batchId, EnrollmentStatus status, Pageable pageable);

    Optional<Enrollment> findByStudentIdAndBatchIdAndStatus(Long studentId, Long batchId, EnrollmentStatus status);

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.student WHERE e.batch.id = :batchId AND (:status IS NULL OR e.status = :status)")
    Page<Enrollment> findBatchStudentsWithUser(@Param("batchId") Long batchId,
                                               @Param("status") EnrollmentStatus status,
                                               Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    Page<Enrollment> findAll(Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    Page<Enrollment> findByStatus(EnrollmentStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE " +
           "LOWER(e.student.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.student.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.course.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Enrollment> searchByText(@Param("search") String search, Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE e.status = :status AND (" +
           "LOWER(e.student.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.student.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.course.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Enrollment> searchByStatusAndText(@Param("status") EnrollmentStatus status,
                                           @Param("search") String search,
                                           Pageable pageable);

    // ── Category-filtered variants ──────────────────────────────────────────

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE e.course.category.id = :catId")
    Page<Enrollment> findByCategoryId(@Param("catId") Long catId, Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE e.status = :status AND e.course.category.id = :catId")
    Page<Enrollment> findByStatusAndCategoryId(@Param("status") EnrollmentStatus status,
                                               @Param("catId") Long catId, Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE e.course.category.id = :catId AND (" +
           "LOWER(e.student.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.student.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.course.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Enrollment> searchByCategoryAndText(@Param("catId") Long catId,
                                             @Param("search") String search, Pageable pageable);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "course", "batch"})
    @Query("SELECT e FROM Enrollment e WHERE e.status = :status AND e.course.category.id = :catId AND (" +
           "LOWER(e.student.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.student.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(e.course.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Enrollment> searchByStatusAndCategoryAndText(@Param("status") EnrollmentStatus status,
                                                      @Param("catId") Long catId,
                                                      @Param("search") String search, Pageable pageable);

    @Query("SELECT new com.onetutor.admin.dto.CourseEnrollmentStatResponse(" +
           "e.course.id, e.course.name, " +
           "COALESCE(e.course.category.name, 'Uncategorized'), " +
           "COUNT(e)) " +
           "FROM Enrollment e " +
           "GROUP BY e.course.id, e.course.name, e.course.category.name " +
           "ORDER BY COUNT(e) DESC")
    List<CourseEnrollmentStatResponse> findEnrollmentStatsByCourse();

    /** Returns the earliest enrolledAt for a student in a given course (used for community message gating). */
    @Query("SELECT MIN(e.enrolledAt) FROM Enrollment e WHERE e.student.id = :studentId AND e.course.id = :courseId")
    java.time.Instant findEarliestEnrolledAt(@Param("studentId") Long studentId, @Param("courseId") Long courseId);
}

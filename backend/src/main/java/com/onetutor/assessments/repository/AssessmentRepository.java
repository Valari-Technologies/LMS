package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.Assessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface AssessmentRepository extends JpaRepository<Assessment, Long> {
    Optional<Assessment> findByContentId(Long contentId);

    @Query("SELECT a FROM Assessment a JOIN a.content c JOIN c.section s WHERE s.course.id = :courseId AND a.enabled = true")
    List<Assessment> findAllByCourseIdAndEnabledTrue(@Param("courseId") Long courseId);

    @Query("SELECT a FROM Assessment a JOIN a.content c JOIN c.section s WHERE s.course.id = :courseId")
    List<Assessment> findAllByCourseId(@Param("courseId") Long courseId);
}

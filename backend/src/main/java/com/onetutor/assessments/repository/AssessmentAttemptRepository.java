package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.AssessmentAttempt;
import com.onetutor.assessments.entity.AssessmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, Long> {
    List<AssessmentAttempt> findByStudentIdAndContentIdOrderByStartedAtDesc(Long studentId, Long contentId);
    
    Optional<AssessmentAttempt> findFirstByStudentIdAndContentIdAndStatus(Long studentId, Long contentId, AssessmentStatus status);

    List<AssessmentAttempt> findByStudentIdAndContentIdAndStatus(Long studentId, Long contentId, AssessmentStatus status);

    @Query("SELECT COUNT(a) FROM AssessmentAttempt a WHERE a.student.id = :studentId AND a.content.id = :contentId")
    int countAttemptsByStudentAndContent(@Param("studentId") Long studentId, @Param("contentId") Long contentId);

    @Query("SELECT a FROM AssessmentAttempt a WHERE a.student.id = :studentId AND a.content.id = :contentId AND a.status = com.onetutor.assessments.entity.AssessmentStatus.COMPLETED ORDER BY a.percentage DESC")
    List<AssessmentAttempt> findPassedAttempts(@Param("studentId") Long studentId, @Param("contentId") Long contentId);
}

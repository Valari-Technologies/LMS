package com.onetutor.progress.repository;

import com.onetutor.progress.entity.Progress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgressRepository extends JpaRepository<Progress, Long> {
    Optional<Progress> findByStudentIdAndContentId(Long studentId, Long contentId);
    List<Progress> findByStudentIdAndContentIdIn(Long studentId, List<Long> contentIds);
    long countByStudentIdAndContentIdInAndCompletedTrue(Long studentId, List<Long> contentIds);
    Optional<Progress> findFirstByStudentIdOrderByLastAccessedAtDesc(Long studentId);
    List<Progress> findByStudentIdOrderByLastAccessedAtDesc(Long studentId);
}

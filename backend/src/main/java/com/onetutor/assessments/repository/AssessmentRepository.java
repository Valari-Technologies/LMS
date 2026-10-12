package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.Assessment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AssessmentRepository extends JpaRepository<Assessment, Long> {
    Optional<Assessment> findByContentId(Long contentId);
}

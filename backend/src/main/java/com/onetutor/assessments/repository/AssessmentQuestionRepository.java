package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.AssessmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestion, Long> {
    List<AssessmentQuestion> findByAssessmentIdOrderByDisplayOrderAsc(Long assessmentId);
    void deleteByAssessmentId(Long assessmentId);
}

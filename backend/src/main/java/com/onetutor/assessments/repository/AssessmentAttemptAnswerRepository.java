package com.onetutor.assessments.repository;

import com.onetutor.assessments.entity.AssessmentAttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptAnswerRepository extends JpaRepository<AssessmentAttemptAnswer, Long> {
    List<AssessmentAttemptAnswer> findByAttemptId(Long attemptId);
    Optional<AssessmentAttemptAnswer> findByAttemptIdAndQuestionId(Long attemptId, Long questionId);
}

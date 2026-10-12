package com.onetutor.assessments.service;

import com.onetutor.assessments.dto.*;
import com.onetutor.assessments.entity.*;
import com.onetutor.assessments.repository.*;
import com.onetutor.audit.service.AuditService;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class AssessmentService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final ContentRepository contentRepository;
    private final AuditService auditService;

    public AssessmentService(AssessmentRepository assessmentRepository,
                             AssessmentQuestionRepository questionRepository,
                             ContentRepository contentRepository,
                             AuditService auditService) {
        this.assessmentRepository = assessmentRepository;
        this.questionRepository = questionRepository;
        this.contentRepository = contentRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Optional<AssessmentAdminResponse> getAdminAssessment(Long contentId) {
        return assessmentRepository.findByContentId(contentId)
                .map(this::toAdminResponse);
    }

    @Transactional
    public AssessmentAdminResponse saveAssessment(Long contentId, AssessmentSaveRequest req, User actor) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("CONTENT_NOT_FOUND", "Content not found"));

        Assessment assessment = assessmentRepository.findByContentId(contentId)
                .orElseGet(() -> {
                    Assessment a = new Assessment();
                    a.setContent(content);
                    return a;
                });

        assessment.setEnabled(req.enabled());
        assessment.setRequired(req.required());
        assessment.setPassPercentage(req.passPercentage());
        if (req.completionMode() != null && !req.completionMode().isBlank()) {
            try {
                assessment.setCompletionMode(CompletionMode.valueOf(req.completionMode().toUpperCase()));
            } catch (IllegalArgumentException e) {
                assessment.setCompletionMode(CompletionMode.PASS_ASSESSMENT);
            }
        }
        assessment.setTimerEnabled(req.timerEnabled());
        assessment.setTimerDurationMinutes(req.timerDurationMinutes() > 0 ? req.timerDurationMinutes() : 10);
        assessment.setRandomizeQuestions(false);
        assessment.setRandomizeOptions(false);

        assessmentRepository.save(assessment);

        // Update questions list
        questionRepository.deleteByAssessmentId(assessment.getId());
        assessment.getQuestions().clear();

        if (req.questions() != null && !req.questions().isEmpty()) {
            List<AssessmentQuestion> newQuestions = new ArrayList<>();
            for (int i = 0; i < req.questions().size(); i++) {
                AssessmentQuestionAdminDto qDto = req.questions().get(i);
                validateQuestion(qDto);

                AssessmentQuestion q = new AssessmentQuestion();
                q.setAssessment(assessment);
                q.setQuestionText(qDto.questionText().trim());
                q.setOptionA(qDto.optionA().trim());
                q.setOptionB(qDto.optionB().trim());
                q.setOptionC(qDto.optionC().trim());
                q.setOptionD(qDto.optionD().trim());
                q.setCorrectAnswer(qDto.correctAnswer().trim().toUpperCase());
                q.setDisplayOrder(i);
                newQuestions.add(q);
            }
            questionRepository.saveAll(newQuestions);
            assessment.getQuestions().addAll(newQuestions);
        }

        auditService.log(actor, "ASSESSMENT_UPDATED", "content", contentId,
                "Configured assessment for lesson '" + content.getTitle() + "' with " + assessment.getQuestions().size() + " questions");

        return toAdminResponse(assessment);
    }

    @Transactional
    public void deleteAssessment(Long contentId, User actor) {
        Assessment assessment = assessmentRepository.findByContentId(contentId)
                .orElseThrow(() -> new NotFoundException("ASSESSMENT_NOT_FOUND", "No assessment found for this lesson"));

        assessmentRepository.delete(assessment);
        auditService.log(actor, "ASSESSMENT_DELETED", "content", contentId, "Deleted assessment for lesson " + contentId);
    }

    private void validateQuestion(AssessmentQuestionAdminDto q) {
        if (q.questionText() == null || q.questionText().isBlank()) {
            throw new BadRequestException("INVALID_QUESTION", "Question text cannot be blank");
        }
        if (q.optionA() == null || q.optionA().isBlank() ||
            q.optionB() == null || q.optionB().isBlank() ||
            q.optionC() == null || q.optionC().isBlank() ||
            q.optionD() == null || q.optionD().isBlank()) {
            throw new BadRequestException("INVALID_OPTIONS", "Every question must have exactly 4 non-empty options (A, B, C, D)");
        }
        String correct = q.correctAnswer() != null ? q.correctAnswer().trim().toUpperCase() : "";
        if (!List.of("A", "B", "C", "D").contains(correct)) {
            throw new BadRequestException("INVALID_CORRECT_ANSWER", "Correct answer must be one of A, B, C, or D");
        }
    }

    public AssessmentAdminResponse toAdminResponse(Assessment a) {
        List<AssessmentQuestionAdminDto> qDtos = a.getQuestions().stream()
                .sorted(Comparator.comparingInt(AssessmentQuestion::getDisplayOrder))
                .map(q -> new AssessmentQuestionAdminDto(
                        q.getId(),
                        q.getQuestionText(),
                        q.getOptionA(),
                        q.getOptionB(),
                        q.getOptionC(),
                        q.getOptionD(),
                        q.getCorrectAnswer(),
                        q.getDisplayOrder()
                )).toList();

        return new AssessmentAdminResponse(
                a.getId(),
                a.getContent().getId(),
                a.isEnabled(),
                a.isRequired(),
                a.getPassPercentage(),
                a.getCompletionMode().name(),
                a.isTimerEnabled(),
                a.getTimerDurationMinutes(),
                a.isRandomizeQuestions(),
                a.isRandomizeOptions(),
                qDtos,
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }
}

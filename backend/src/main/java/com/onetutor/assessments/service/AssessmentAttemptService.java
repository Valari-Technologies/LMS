package com.onetutor.assessments.service;

import com.onetutor.assessments.dto.*;
import com.onetutor.assessments.entity.*;
import com.onetutor.assessments.repository.*;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ForbiddenException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.enrollment.service.EnrollmentService;
import com.onetutor.progress.entity.Progress;
import com.onetutor.progress.repository.ProgressRepository;
import com.onetutor.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class AssessmentAttemptService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAttemptAnswerRepository answerRepository;
    private final AssessmentAuditLogRepository auditLogRepository;
    private final ContentRepository contentRepository;
    private final ProgressRepository progressRepository;
    private final EnrollmentService enrollmentService;

    public AssessmentAttemptService(AssessmentRepository assessmentRepository,
                                    AssessmentQuestionRepository questionRepository,
                                    AssessmentAttemptRepository attemptRepository,
                                    AssessmentAttemptAnswerRepository answerRepository,
                                    AssessmentAuditLogRepository auditLogRepository,
                                    ContentRepository contentRepository,
                                    ProgressRepository progressRepository,
                                    EnrollmentService enrollmentService) {
        this.assessmentRepository = assessmentRepository;
        this.questionRepository = questionRepository;
        this.attemptRepository = attemptRepository;
        this.answerRepository = answerRepository;
        this.auditLogRepository = auditLogRepository;
        this.contentRepository = contentRepository;
        this.progressRepository = progressRepository;
        this.enrollmentService = enrollmentService;
    }

    @Transactional(readOnly = true)
    public AssessmentStudentResponse getStudentAssessmentInfo(Long contentId, User student) {
        Content content = findContentOrThrow(contentId);
        enrollmentService.assertActiveEnrollment(student, content.getSection().getCourse().getId());

        Assessment assessment = assessmentRepository.findByContentId(contentId)
                .orElseThrow(() -> new NotFoundException("ASSESSMENT_NOT_FOUND", "No assessment found for this lesson"));

        if (!assessment.isEnabled()) {
            throw new BadRequestException("ASSESSMENT_DISABLED", "Assessment is disabled for this lesson");
        }

        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessment.getId());
        List<QuestionStudentDto> questionDtos = questions.stream()
                .sorted(Comparator.comparingInt(AssessmentQuestion::getDisplayOrder))
                .map(q -> new QuestionStudentDto(
                        q.getId(),
                        q.getQuestionText(),
                        q.getOptionA(),
                        q.getOptionB(),
                        q.getOptionC(),
                        q.getOptionD(),
                        q.getDisplayOrder()
                )).toList();

        AssessmentSummaryDto summary = getSummaryForStudent(contentId, student);

        return new AssessmentStudentResponse(
                assessment.getId(),
                contentId,
                content.getTitle(),
                assessment.isEnabled(),
                assessment.isRequired(),
                assessment.getPassPercentage(),
                assessment.getCompletionMode().name(),
                assessment.isTimerEnabled(),
                assessment.getTimerDurationMinutes(),
                questions.size(),
                questionDtos,
                summary
        );
    }

    @Transactional(readOnly = true)
    public AssessmentSummaryDto getSummaryForStudent(Long contentId, User student) {
        Optional<Assessment> assessmentOpt = assessmentRepository.findByContentId(contentId);
        if (assessmentOpt.isEmpty() || !assessmentOpt.get().isEnabled()) {
            return new AssessmentSummaryDto(false, false, false, false, 0, 0, 0.0, 0, 0, null, null, null);
        }

        Assessment assessment = assessmentOpt.get();
        List<AssessmentAttempt> attempts = attemptRepository.findByStudentIdAndContentIdOrderByStartedAtDesc(student.getId(), contentId);

        int count = attempts.size();
        boolean completed = false;
        boolean passed = false;
        int bestScore = 0;
        double bestPct = 0.0;
        Long activeAttemptId = null;
        String activeStatus = null;
        Long latestAttemptId = attempts.isEmpty() ? null : attempts.get(0).getId();

        for (AssessmentAttempt a : attempts) {
            if (a.getStatus() == AssessmentStatus.IN_PROGRESS) {
                if (activeAttemptId == null) {
                    activeAttemptId = a.getId();
                    activeStatus = a.getStatus().name();
                }
            } else if (a.getStatus() == AssessmentStatus.COMPLETED) {
                completed = true;
                if (a.getObtainedMarks() > bestScore) {
                    bestScore = a.getObtainedMarks();
                }
                if (a.getPercentage() > bestPct) {
                    bestPct = a.getPercentage();
                }
                if (a.getPercentage() >= assessment.getPassPercentage() || assessment.getCompletionMode() == CompletionMode.SUBMIT_ASSESSMENT) {
                    passed = true;
                }
            }
        }

        int totalQuestions = assessment.getQuestions().size();

        return new AssessmentSummaryDto(
                true,
                assessment.isRequired(),
                completed,
                passed,
                totalQuestions,
                bestScore,
                bestPct,
                assessment.getPassPercentage(),
                count,
                activeAttemptId,
                activeStatus,
                latestAttemptId
        );
    }

    @Transactional
    public AttemptDetailResponse startAttempt(Long assessmentId, User student) {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new NotFoundException("ASSESSMENT_NOT_FOUND", "Assessment not found"));

        if (!assessment.isEnabled()) {
            throw new BadRequestException("ASSESSMENT_DISABLED", "This assessment is currently disabled");
        }

        Content content = assessment.getContent();
        enrollmentService.assertActiveEnrollment(student.getId(), content.getSection().getCourse().getId());

        // Invalidate any existing IN_PROGRESS attempt (multiple tab switch / restart protection)
        List<AssessmentAttempt> activeAttempts = attemptRepository.findByStudentIdAndContentIdAndStatus(
                student.getId(), content.getId(), AssessmentStatus.IN_PROGRESS);
        for (AssessmentAttempt active : activeAttempts) {
            active.setStatus(AssessmentStatus.TERMINATED);
            active.setTerminatedReason("MULTIPLE_TABS");
            attemptRepository.save(active);

            logAudit(student, assessment, active, AssessmentEventType.ASSESSMENT_TERMINATED, "Terminated due to new attempt initiated");
        }

        int attemptCount = attemptRepository.countAttemptsByStudentAndContent(student.getId(), content.getId());

        AssessmentAttempt attempt = new AssessmentAttempt();
        attempt.setStudent(student);
        attempt.setContent(content);
        attempt.setAssessment(assessment);
        attempt.setStartedAt(Instant.now());
        attempt.setLastActivityAt(Instant.now());
        attempt.setStatus(AssessmentStatus.IN_PROGRESS);
        attempt.setTotalQuestions(assessment.getQuestions().size());
        attempt.setAttemptNumber(attemptCount + 1);
        attempt.setSessionToken(UUID.randomUUID().toString());

        attemptRepository.save(attempt);

        logAudit(student, assessment, attempt, AssessmentEventType.ASSESSMENT_STARTED, "Attempt #" + attempt.getAttemptNumber() + " started");

        return toAttemptDetailResponse(attempt);
    }

    @Transactional
    public AttemptDetailResponse saveAnswer(Long attemptId, SaveAnswerRequest req, User student) {
        AssessmentAttempt attempt = findAttemptOrThrow(attemptId, student);
        checkAttemptActive(attempt);

        AssessmentQuestion question = questionRepository.findById(req.questionId())
                .orElseThrow(() -> new NotFoundException("QUESTION_NOT_FOUND", "Question not found"));

        if (!question.getAssessment().getId().equals(attempt.getAssessment().getId())) {
            throw new BadRequestException("INVALID_QUESTION", "Question does not belong to this assessment");
        }

        AssessmentAttemptAnswer answer = answerRepository.findByAttemptIdAndQuestionId(attemptId, req.questionId())
                .orElseGet(() -> {
                    AssessmentAttemptAnswer a = new AssessmentAttemptAnswer();
                    a.setAttempt(attempt);
                    a.setQuestion(question);
                    return a;
                });

        String selected = req.selectedOption() != null ? req.selectedOption().trim().toUpperCase() : null;
        if (selected != null && !selected.isBlank() && !List.of("A", "B", "C", "D").contains(selected)) {
            throw new BadRequestException("INVALID_OPTION", "Selected option must be A, B, C, or D");
        }

        answer.setSelectedOption(selected);
        answerRepository.save(answer);

        attempt.setLastActivityAt(Instant.now());
        attemptRepository.save(attempt);

        logAudit(student, attempt.getAssessment(), attempt, AssessmentEventType.QUESTION_ANSWERED,
                "Answered question ID " + question.getId() + " with option " + selected);

        return toAttemptDetailResponse(attempt);
    }

    @Transactional
    public AttemptDetailResponse submitAttempt(Long attemptId, User student) {
        AssessmentAttempt attempt = findAttemptOrThrow(attemptId, student);
        checkAttemptActive(attempt);

        Assessment assessment = attempt.getAssessment();
        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessment.getId());
        List<AssessmentAttemptAnswer> savedAnswers = answerRepository.findByAttemptId(attemptId);

        Map<Long, String> answerMap = savedAnswers.stream()
                .filter(a -> a.getSelectedOption() != null)
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), AssessmentAttemptAnswer::getSelectedOption));

        int correctCount = 0;

        for (AssessmentQuestion q : questions) {
            String studentChoice = answerMap.get(q.getId());
            boolean isCorrect = studentChoice != null && studentChoice.equalsIgnoreCase(q.getCorrectAnswer());

            // Save/update answer record with correctness score calculated on server
            AssessmentAttemptAnswer ansRecord = answerRepository.findByAttemptIdAndQuestionId(attemptId, q.getId())
                    .orElseGet(() -> {
                        AssessmentAttemptAnswer a = new AssessmentAttemptAnswer();
                        a.setAttempt(attempt);
                        a.setQuestion(q);
                        return a;
                    });
            ansRecord.setSelectedOption(studentChoice);
            ansRecord.setIsCorrect(isCorrect);
            answerRepository.save(ansRecord);

            if (isCorrect) {
                correctCount++;
            }
        }

        int totalQuestions = questions.size();
        double percentage = totalQuestions > 0 ? (double) correctCount / totalQuestions * 100.0 : 0.0;
        percentage = Math.round(percentage * 10.0) / 10.0;

        boolean passed = percentage >= assessment.getPassPercentage() || assessment.getCompletionMode() == CompletionMode.SUBMIT_ASSESSMENT;

        attempt.setTotalQuestions(totalQuestions);
        attempt.setCorrectAnswers(correctCount);
        attempt.setObtainedMarks(correctCount); // 1 mark per question
        attempt.setPercentage(percentage);
        attempt.setSubmittedAt(Instant.now());
        attempt.setStatus(passed ? AssessmentStatus.COMPLETED : AssessmentStatus.FAILED);
        attempt.setLastActivityAt(Instant.now());

        attemptRepository.save(attempt);

        // Audit Logging
        logAudit(student, assessment, attempt, AssessmentEventType.ASSESSMENT_SUBMITTED,
                "Submitted score: " + correctCount + "/" + totalQuestions + " (" + percentage + "%)");

        if (passed) {
            logAudit(student, assessment, attempt, AssessmentEventType.ASSESSMENT_PASSED, "Passed with score " + percentage + "%");
            markLessonCompletedIfEligible(student, attempt.getContent());
        } else {
            logAudit(student, assessment, attempt, AssessmentEventType.ASSESSMENT_FAILED, "Failed with score " + percentage + "% (Required: " + assessment.getPassPercentage() + "%)");
        }

        return toAttemptDetailResponse(attempt);
    }

    @Transactional
    public AttemptDetailResponse terminateAttempt(Long attemptId, String reason, User student) {
        AssessmentAttempt attempt = findAttemptOrThrow(attemptId, student);
        if (attempt.getStatus() == AssessmentStatus.IN_PROGRESS) {
            String termReason = (reason != null && !reason.isBlank()) ? reason.toUpperCase() : "TAB_SWITCH";
            attempt.setStatus(AssessmentStatus.TERMINATED);
            attempt.setTerminatedReason(termReason);
            attempt.setLastActivityAt(Instant.now());
            attemptRepository.save(attempt);

            AssessmentEventType eventType = "TAB_SWITCH".equals(termReason) ? AssessmentEventType.TAB_SWITCH : AssessmentEventType.ASSESSMENT_TERMINATED;
            logAudit(student, attempt.getAssessment(), attempt, eventType, "Attempt terminated. Reason: " + termReason);
        }

        return toAttemptDetailResponse(attempt);
    }

    @Transactional(readOnly = true)
    public AttemptDetailResponse getAttempt(Long attemptId, User student) {
        AssessmentAttempt attempt = findAttemptOrThrow(attemptId, student);
        return toAttemptDetailResponse(attempt);
    }

    private void checkAttemptActive(AssessmentAttempt attempt) {
        if (attempt.getStatus() != AssessmentStatus.IN_PROGRESS) {
            throw new BadRequestException("ATTEMPT_NOT_ACTIVE", "This attempt is no longer active (Status: " + attempt.getStatus() + ")");
        }

        Assessment assessment = attempt.getAssessment();
        if (assessment.isTimerEnabled()) {
            long durationSeconds = assessment.getTimerDurationMinutes() * 60L;
            long elapsedSeconds = Duration.between(attempt.getStartedAt(), Instant.now()).getSeconds();
            if (elapsedSeconds > durationSeconds + 5) { // 5s buffer
                attempt.setStatus(AssessmentStatus.TERMINATED);
                attempt.setTerminatedReason("TIME_EXPIRED");
                attemptRepository.save(attempt);

                logAudit(attempt.getStudent(), assessment, attempt, AssessmentEventType.TIME_EXPIRED, "Timer expired after " + elapsedSeconds + "s");
                throw new BadRequestException("TIME_EXPIRED", "Assessment time limit has expired. Your attempt was terminated.");
            }
        }
    }

    private void markLessonCompletedIfEligible(User student, Content content) {
        Progress progress = progressRepository.findByStudentIdAndContentId(student.getId(), content.getId())
                .orElseGet(() -> {
                    Progress p = new Progress();
                    p.setStudent(student);
                    p.setContent(content);
                    return p;
                });

        progress.setCompleted(true);
        if (progress.getCompletedAt() == null) {
            progress.setCompletedAt(Instant.now());
        }
        progress.setProgressPercent(100);
        progress.setLastAccessedAt(Instant.now());
        progressRepository.save(progress);
    }

    private AssessmentAttempt findAttemptOrThrow(Long attemptId, User student) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new NotFoundException("ATTEMPT_NOT_FOUND", "Assessment attempt not found"));

        if (!attempt.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("UNAUTHORIZED_ATTEMPT", "You do not have permission to view or modify this attempt");
        }
        return attempt;
    }

    private Content findContentOrThrow(Long contentId) {
        return contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("CONTENT_NOT_FOUND", "Content not found"));
    }

    private void logAudit(User student, Assessment assessment, AssessmentAttempt attempt, AssessmentEventType type, String metadata) {
        AssessmentAuditLog log = new AssessmentAuditLog();
        log.setStudent(student);
        log.setAssessment(assessment);
        log.setAttempt(attempt);
        log.setEventType(type);
        log.setTimestamp(Instant.now());
        log.setMetadata(metadata);
        auditLogRepository.save(log);
    }

    public AttemptDetailResponse toAttemptDetailResponse(AssessmentAttempt attempt) {
        Assessment assessment = attempt.getAssessment();
        List<AssessmentAttemptAnswer> answers = answerRepository.findByAttemptId(attempt.getId());

        Map<Long, String> selectedMap = answers.stream()
                .filter(a -> a.getSelectedOption() != null)
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), AssessmentAttemptAnswer::getSelectedOption));

        long timeRemaining = -1;
        if (assessment.isTimerEnabled() && attempt.getStatus() == AssessmentStatus.IN_PROGRESS) {
            long totalSeconds = assessment.getTimerDurationMinutes() * 60L;
            long elapsedSeconds = Duration.between(attempt.getStartedAt(), Instant.now()).getSeconds();
            timeRemaining = Math.max(0, totalSeconds - elapsedSeconds);
        }

        boolean passed = attempt.getStatus() == AssessmentStatus.COMPLETED &&
                (attempt.getPercentage() >= assessment.getPassPercentage() || assessment.getCompletionMode() == CompletionMode.SUBMIT_ASSESSMENT);

        int totalQuestions = attempt.getTotalQuestions() > 0 ? attempt.getTotalQuestions() : assessment.getQuestions().size();
        int wrongAnswers = Math.max(0, totalQuestions - attempt.getCorrectAnswers());

        return new AttemptDetailResponse(
                attempt.getId(),
                assessment.getId(),
                attempt.getContent().getId(),
                attempt.getStatus().name(),
                attempt.getTerminatedReason(),
                attempt.getAttemptNumber(),
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                timeRemaining,
                totalQuestions,
                attempt.getCorrectAnswers(),
                wrongAnswers,
                attempt.getObtainedMarks(),
                attempt.getPercentage(),
                passed,
                assessment.getPassPercentage(),
                selectedMap
        );
    }
}

package com.onetutor.assessments.controller;

import com.onetutor.assessments.dto.*;
import com.onetutor.assessments.service.AssessmentAttemptService;
import com.onetutor.common.ApiResponse;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AssessmentStudentController {

    private final AssessmentAttemptService attemptService;

    public AssessmentStudentController(AssessmentAttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @GetMapping("/contents/{contentId}/assessment-info")
    public ApiResponse<AssessmentStudentResponse> getAssessmentInfo(@PathVariable Long contentId,
                                                                    @AuthenticationPrincipal User caller) {
        return ApiResponse.ok(attemptService.getStudentAssessmentInfo(contentId, caller));
    }

    @PostMapping("/assessments/{assessmentId}/attempts")
    public ApiResponse<AttemptDetailResponse> startAttempt(@PathVariable Long assessmentId,
                                                           @AuthenticationPrincipal User caller) {
        return ApiResponse.ok("Assessment attempt started", attemptService.startAttempt(assessmentId, caller));
    }

    @GetMapping("/assessment-attempts/{attemptId}")
    public ApiResponse<AttemptDetailResponse> getAttempt(@PathVariable Long attemptId,
                                                         @AuthenticationPrincipal User caller) {
        return ApiResponse.ok(attemptService.getAttempt(attemptId, caller));
    }

    @PostMapping("/assessment-attempts/{attemptId}/answer")
    public ApiResponse<AttemptDetailResponse> saveAnswer(@PathVariable Long attemptId,
                                                          @Valid @RequestBody SaveAnswerRequest req,
                                                          @AuthenticationPrincipal User caller) {
        return ApiResponse.ok(attemptService.saveAnswer(attemptId, req, caller));
    }

    @PostMapping("/assessment-attempts/{attemptId}/submit")
    public ApiResponse<AttemptDetailResponse> submitAttempt(@PathVariable Long attemptId,
                                                             @AuthenticationPrincipal User caller) {
        return ApiResponse.ok("Assessment submitted successfully", attemptService.submitAttempt(attemptId, caller));
    }

    @PostMapping("/assessment-attempts/{attemptId}/terminate")
    public ApiResponse<AttemptDetailResponse> terminateAttempt(@PathVariable Long attemptId,
                                                                @RequestBody(required = false) TerminateAttemptRequest req,
                                                                @AuthenticationPrincipal User caller) {
        String reason = req != null && req.reason() != null ? req.reason() : "TAB_SWITCH";
        return ApiResponse.ok("Attempt terminated", attemptService.terminateAttempt(attemptId, reason, caller));
    }
}

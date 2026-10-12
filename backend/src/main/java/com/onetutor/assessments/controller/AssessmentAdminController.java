package com.onetutor.assessments.controller;

import com.onetutor.assessments.dto.AssessmentAdminResponse;
import com.onetutor.assessments.dto.AssessmentSaveRequest;
import com.onetutor.assessments.service.AssessmentService;
import com.onetutor.common.ApiResponse;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/contents/{contentId}/assessment")
public class AssessmentAdminController {

    private final AssessmentService assessmentService;

    public AssessmentAdminController(AssessmentService assessmentService) {
        this.assessmentService = assessmentService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<AssessmentAdminResponse> get(@PathVariable Long contentId) {
        return assessmentService.getAdminAssessment(contentId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.ok(null));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<AssessmentAdminResponse> save(@PathVariable Long contentId,
                                                      @Valid @RequestBody AssessmentSaveRequest req,
                                                      @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Assessment saved successfully", assessmentService.saveAssessment(contentId, req, actor));
    }

    @DeleteMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> delete(@PathVariable Long contentId,
                                    @AuthenticationPrincipal User actor) {
        assessmentService.deleteAssessment(contentId, actor);
        return ApiResponse.ok("Assessment deleted successfully", null);
    }
}

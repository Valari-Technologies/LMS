package com.onetutor.assessments.controller;

import com.onetutor.assessments.dto.AssessmentAdminResponse;
import com.onetutor.assessments.dto.AssessmentSaveRequest;
import com.onetutor.assessments.dto.StudentAssessmentAttemptAdminDto;
import com.onetutor.assessments.service.AssessmentAttemptService;
import com.onetutor.assessments.service.AssessmentService;
import com.onetutor.common.ApiResponse;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class AssessmentAdminController {

    private final AssessmentService assessmentService;
    private final AssessmentAttemptService assessmentAttemptService;

    public AssessmentAdminController(AssessmentService assessmentService,
                                     AssessmentAttemptService assessmentAttemptService) {
        this.assessmentService = assessmentService;
        this.assessmentAttemptService = assessmentAttemptService;
    }

    @GetMapping("/contents/{contentId}/assessment")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<AssessmentAdminResponse> get(@PathVariable Long contentId) {
        return assessmentService.getAdminAssessment(contentId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.ok(null));
    }

    @PostMapping("/contents/{contentId}/assessment")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<AssessmentAdminResponse> save(@PathVariable Long contentId,
                                                      @Valid @RequestBody AssessmentSaveRequest req,
                                                      @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Assessment saved successfully", assessmentService.saveAssessment(contentId, req, actor));
    }

    @DeleteMapping("/contents/{contentId}/assessment")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> delete(@PathVariable Long contentId,
                                    @AuthenticationPrincipal User actor) {
        assessmentService.deleteAssessment(contentId, actor);
        return ApiResponse.ok("Assessment deleted successfully", null);
    }

    @GetMapping("/admin/assessments")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<List<AssessmentAdminResponse>> getAllAssessments(@RequestParam(required = false) Long courseId) {
        if (courseId != null) {
            return ApiResponse.ok(assessmentService.getAdminCourseAssessments(courseId));
        }
        return ApiResponse.ok(assessmentService.getAllAdminAssessments());
    }

    @GetMapping("/contents/{contentId}/assessment/attempts")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<List<StudentAssessmentAttemptAdminDto>> getAttempts(@PathVariable Long contentId) {
        return ApiResponse.ok(assessmentAttemptService.getAssessmentAttemptsForAdmin(contentId));
    }
}

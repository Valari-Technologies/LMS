package com.onetutor.batches.controller;

import com.onetutor.batches.dto.*;
import com.onetutor.batches.entity.BatchStatus;
import com.onetutor.batches.service.BatchService;
import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.users.entity.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/batches")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
public class AdminBatchController {

    private final BatchService batchService;

    public AdminBatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    @GetMapping
    public ApiResponse<PageResponse<BatchResponse>> list(
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        BatchStatus batchStatus = null;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            try {
                batchStatus = BatchStatus.valueOf(status.toLowerCase());
            } catch (IllegalArgumentException ignored) {}
        }
        return ApiResponse.ok(batchService.adminList(courseId, batchStatus, search,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))));
    }

    @PostMapping
    public ApiResponse<BatchResponse> create(@Valid @RequestBody CreateBatchRequest req,
                                             @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Batch created successfully", batchService.create(req, actor));
    }

    @GetMapping("/{id}")
    public ApiResponse<BatchResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(batchService.getBatch(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<BatchResponse> update(@PathVariable Long id,
                                             @Valid @RequestBody UpdateBatchRequest req,
                                             @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Batch updated successfully", batchService.update(id, req, actor));
    }

    @PutMapping("/{id}/status")
    public ApiResponse<BatchResponse> updateStatus(@PathVariable Long id,
                                                   @RequestParam String status,
                                                   @AuthenticationPrincipal User actor) {
        BatchStatus batchStatus;
        try {
            batchStatus = BatchStatus.valueOf(status.trim().toLowerCase());
        } catch (Exception e) {
            throw new com.onetutor.common.exceptions.BadRequestException("INVALID_STATUS", "Invalid batch status: " + status);
        }
        return ApiResponse.ok("Batch status updated successfully", batchService.updateStatus(id, batchStatus, actor));
    }

    @GetMapping("/{id}/students")
    public ApiResponse<PageResponse<BatchStudentResponse>> listStudents(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(batchService.listBatchStudents(id,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "enrolledAt"))));
    }

    @DeleteMapping("/{id}/students/{enrollmentId}")
    public ApiResponse<Void> removeStudent(
            @PathVariable Long id,
            @PathVariable Long enrollmentId,
            @AuthenticationPrincipal User actor) {
        batchService.removeStudentFromBatch(id, enrollmentId, actor);
        return ApiResponse.ok("Student removed from batch successfully; 1 seat released", null);
    }

    @PutMapping("/{id}/students/{enrollmentId}/change-batch")
    public ApiResponse<Void> changeStudentBatch(
            @PathVariable Long id,
            @PathVariable Long enrollmentId,
            @Valid @RequestBody ChangeStudentBatchRequest req,
            @AuthenticationPrincipal User actor) {
        batchService.changeStudentBatch(id, enrollmentId, req.targetBatchId(), actor);
        return ApiResponse.ok("Student batch changed successfully", null);
    }
}

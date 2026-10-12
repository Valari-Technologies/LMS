package com.onetutor.batches.controller;

import com.onetutor.batches.dto.BatchResponse;
import com.onetutor.batches.service.BatchService;
import com.onetutor.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/courses/{courseId}/batches")
public class StudentBatchController {

    private final BatchService batchService;

    public StudentBatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    @GetMapping
    public ApiResponse<List<BatchResponse>> listForCourse(@PathVariable Long courseId) {
        return ApiResponse.ok(batchService.listBatchesForCourse(courseId, false));
    }
}

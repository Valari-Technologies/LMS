package com.onetutor.live.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.live.dto.LiveSessionResponse;
import com.onetutor.live.service.LiveSessionService;
import com.onetutor.users.entity.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/live-sessions")
public class LiveSessionController {

    private final LiveSessionService liveSessionService;

    public LiveSessionController(LiveSessionService liveSessionService) {
        this.liveSessionService = liveSessionService;
    }

    @GetMapping
    public ApiResponse<List<LiveSessionResponse>> listUpcoming(@AuthenticationPrincipal User student) {
        return ApiResponse.ok(liveSessionService.listStudentUpcomingSessions(student));
    }

    @GetMapping("/{id}")
    public ApiResponse<LiveSessionResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(liveSessionService.getSession(id));
    }

    @GetMapping("/{id}/join-info")
    public ApiResponse<com.onetutor.live.dto.LiveClassroomJoinInfo> getJoinInfo(@PathVariable Long id,
                                                                                @AuthenticationPrincipal User user) {
        return ApiResponse.ok(liveSessionService.getJoinInfo(id, user));
    }
}


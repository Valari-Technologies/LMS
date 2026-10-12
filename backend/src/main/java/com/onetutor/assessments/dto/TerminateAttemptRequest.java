package com.onetutor.assessments.dto;

public record TerminateAttemptRequest(
        String reason // 'TAB_SWITCH', 'TIME_EXPIRED', 'WINDOW_BLUR', 'MULTIPLE_TABS'
) {}

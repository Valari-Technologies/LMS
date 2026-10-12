package com.onetutor.live.dto;

public record AttachRecordingRequest(
        String url,
        Long mediaAssetId,
        Integer duration
) {}


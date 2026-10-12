package com.onetutor.contents.dto;

public record ResourceResponse(
        Long id,
        String type,
        String name,
        String url,
        int displayOrder
) {}

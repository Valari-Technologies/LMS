package com.onetutor.contact.dto;

public record ContactStatsResponse(
        long total,
        long pending,
        long replied,
        long archived
) {}

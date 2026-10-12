package com.onetutor.banners.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BannerRequest {
    @NotBlank(message = "Title is required")
    private String title;
    private String subtitle;
    private String imageUrl;
    private String cloudinaryPublicId;
    private String ctaText;
    private String ctaLink;
    private String badgeText;
    private int displayOrder;
    private boolean active = true;
}

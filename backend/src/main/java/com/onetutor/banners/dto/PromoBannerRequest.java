package com.onetutor.banners.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PromoBannerRequest {
    @NotBlank(message = "Title is required")
    private String title;
    private String subtitle;
    private String bgColor;
    private String textColor;
    private String accentColor;
    private String imageUrl;
    private String secondaryImageUrl;
    private String imageAlignment; // "left" or "right"
    private String ctaText;
    private String ctaLink;
    private String ctaBgColor;
    private String ctaTextColor;
    private String secondaryLinkText;
    private String secondaryLinkUrl;
    private String secondaryLinkColor;
    private String featuresJson;
    private Integer featuresColumns = 2;

    @JsonProperty("active")
    private boolean active = true;
}

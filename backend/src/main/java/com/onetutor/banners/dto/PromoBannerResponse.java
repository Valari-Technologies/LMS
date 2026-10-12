package com.onetutor.banners.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.onetutor.banners.entity.PromoBanner;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class PromoBannerResponse {
    private Long id;
    private String title;
    private String subtitle;
    private String bgColor;
    private String textColor;
    private String accentColor;
    private String imageUrl;
    private String secondaryImageUrl;
    private String imageAlignment;
    private String ctaText;
    private String ctaLink;
    private String ctaBgColor;
    private String ctaTextColor;
    private String secondaryLinkText;
    private String secondaryLinkUrl;
    private String secondaryLinkColor;
    private String featuresJson;
    private Integer featuresColumns;

    @JsonProperty("active")
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public static PromoBannerResponse fromEntity(PromoBanner b) {
        if (b == null) return null;
        return PromoBannerResponse.builder()
                .id(b.getId())
                .title(b.getTitle())
                .subtitle(b.getSubtitle())
                .bgColor(b.getBgColor())
                .textColor(b.getTextColor())
                .accentColor(b.getAccentColor())
                .imageUrl(b.getImageUrl())
                .secondaryImageUrl(b.getSecondaryImageUrl())
                .imageAlignment(b.getImageAlignment())
                .ctaText(b.getCtaText())
                .ctaLink(b.getCtaLink())
                .ctaBgColor(b.getCtaBgColor())
                .ctaTextColor(b.getCtaTextColor())
                .secondaryLinkText(b.getSecondaryLinkText())
                .secondaryLinkUrl(b.getSecondaryLinkUrl())
                .secondaryLinkColor(b.getSecondaryLinkColor() != null ? b.getSecondaryLinkColor() : "#ffffff")
                .featuresJson(b.getFeaturesJson())
                .featuresColumns(b.getFeaturesColumns() != null ? b.getFeaturesColumns() : 2)
                .active(b.isActive())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}

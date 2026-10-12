package com.onetutor.banners.dto;

import com.onetutor.banners.entity.HeroBanner;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class BannerResponse {
    private Long id;
    private String title;
    private String subtitle;
    private String imageUrl;
    private String cloudinaryPublicId;
    private String ctaText;
    private String ctaLink;
    private String badgeText;
    private int displayOrder;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public static BannerResponse fromEntity(HeroBanner b) {
        return BannerResponse.builder()
                .id(b.getId())
                .title(b.getTitle())
                .subtitle(b.getSubtitle())
                .imageUrl(b.getImageUrl())
                .cloudinaryPublicId(b.getCloudinaryPublicId())
                .ctaText(b.getCtaText() != null ? b.getCtaText() : "Explore Courses")
                .ctaLink(b.getCtaLink() != null ? b.getCtaLink() : "/student/courses")
                .badgeText(b.getBadgeText() != null ? b.getBadgeText() : "Featured")
                .displayOrder(b.getDisplayOrder())
                .active(b.isActive())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}

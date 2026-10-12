package com.onetutor.banners.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "promo_banners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromoBanner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String subtitle;

    @Column(name = "bg_color", length = 100)
    @Builder.Default
    private String bgColor = "#1c1d29";

    @Column(name = "text_color", length = 50)
    @Builder.Default
    private String textColor = "#ffffff";

    @Column(name = "accent_color", length = 50)
    @Builder.Default
    private String accentColor = "#a855f7";

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(name = "secondary_image_url", length = 1024)
    private String secondaryImageUrl;

    @Column(name = "image_alignment", length = 20)
    @Builder.Default
    private String imageAlignment = "right";

    @Column(name = "cta_text", length = 100)
    @Builder.Default
    private String ctaText = "Subscribe now";

    @Column(name = "cta_link", length = 255)
    @Builder.Default
    private String ctaLink = "/student/courses";

    @Column(name = "cta_bg_color", length = 50)
    @Builder.Default
    private String ctaBgColor = "#ffffff";

    @Column(name = "cta_text_color", length = 50)
    @Builder.Default
    private String ctaTextColor = "#1c1d29";

    @Column(name = "secondary_link_text", length = 100)
    @Builder.Default
    private String secondaryLinkText = "Learn more";

    @Column(name = "secondary_link_url", length = 255)
    @Builder.Default
    private String secondaryLinkUrl = "/student/courses";

    @Column(name = "secondary_link_color", length = 50)
    @Builder.Default
    private String secondaryLinkColor = "#ffffff";

    @Column(name = "features_json", columnDefinition = "TEXT")
    private String featuresJson;

    @Column(name = "features_columns")
    @Builder.Default
    private Integer featuresColumns = 2;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

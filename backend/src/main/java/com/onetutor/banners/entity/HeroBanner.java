package com.onetutor.banners.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "hero_banners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HeroBanner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String subtitle;

    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    @Column(name = "cloudinary_public_id")
    private String cloudinaryPublicId;

    @Column(name = "cta_text", length = 100)
    private String ctaText;

    @Column(name = "cta_link", length = 255)
    private String ctaLink;

    @Column(name = "badge_text", length = 100)
    private String badgeText;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

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

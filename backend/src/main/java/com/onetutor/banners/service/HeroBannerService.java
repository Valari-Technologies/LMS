package com.onetutor.banners.service;

import com.onetutor.banners.dto.BannerRequest;
import com.onetutor.banners.dto.BannerResponse;
import com.onetutor.banners.entity.HeroBanner;
import com.onetutor.banners.repository.HeroBannerRepository;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.media.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HeroBannerService {

    private final HeroBannerRepository bannerRepository;
    private final CloudinaryService cloudinaryService;

    @Transactional(readOnly = true)
    public List<BannerResponse> getActiveBanners() {
        return bannerRepository.findByActiveTrueOrderByDisplayOrderAsc()
                .stream()
                .map(BannerResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BannerResponse> getAllBanners() {
        return bannerRepository.findAllByOrderByDisplayOrderAsc()
                .stream()
                .map(BannerResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BannerResponse getBanner(Long id) {
        HeroBanner banner = bannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BANNER_NOT_FOUND", "Hero banner not found with id: " + id));
        return BannerResponse.fromEntity(banner);
    }

    @Transactional
    public BannerResponse createBanner(BannerRequest req) {
        HeroBanner banner = HeroBanner.builder()
                .title(req.getTitle())
                .subtitle(req.getSubtitle())
                .imageUrl(req.getImageUrl())
                .cloudinaryPublicId(req.getCloudinaryPublicId())
                .ctaText(req.getCtaText() != null && !req.getCtaText().isBlank() ? req.getCtaText() : "Explore Courses")
                .ctaLink(req.getCtaLink() != null && !req.getCtaLink().isBlank() ? req.getCtaLink() : "/student/courses")
                .badgeText(req.getBadgeText() != null && !req.getBadgeText().isBlank() ? req.getBadgeText() : "Featured")
                .displayOrder(req.getDisplayOrder())
                .active(req.isActive())
                .build();

        HeroBanner saved = bannerRepository.save(banner);
        log.info("Created new hero banner: id={}, title={}", saved.getId(), saved.getTitle());
        return BannerResponse.fromEntity(saved);
    }

    @Transactional
    public BannerResponse updateBanner(Long id, BannerRequest req) {
        HeroBanner banner = bannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BANNER_NOT_FOUND", "Hero banner not found with id: " + id));

        banner.setTitle(req.getTitle());
        banner.setSubtitle(req.getSubtitle());
        if (req.getImageUrl() != null && !req.getImageUrl().isBlank() && !req.getImageUrl().equals(banner.getImageUrl())) {
            if (banner.getCloudinaryPublicId() != null) {
                cloudinaryService.deleteBannerImage(banner.getCloudinaryPublicId());
            } else if (banner.getImageUrl() != null && banner.getImageUrl().contains("cloudinary.com/")) {
                cloudinaryService.deleteFileByUrl(banner.getImageUrl());
            }
            banner.setImageUrl(req.getImageUrl());
        }
        if (req.getCloudinaryPublicId() != null) {
            banner.setCloudinaryPublicId(req.getCloudinaryPublicId());
        }
        if (req.getCtaText() != null) banner.setCtaText(req.getCtaText());
        if (req.getCtaLink() != null) banner.setCtaLink(req.getCtaLink());
        if (req.getBadgeText() != null) banner.setBadgeText(req.getBadgeText());
        banner.setDisplayOrder(req.getDisplayOrder());
        banner.setActive(req.isActive());

        HeroBanner updated = bannerRepository.save(banner);
        log.info("Updated hero banner: id={}", updated.getId());
        return BannerResponse.fromEntity(updated);
    }

    @Transactional
    public BannerResponse toggleBannerStatus(Long id, boolean active) {
        HeroBanner banner = bannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BANNER_NOT_FOUND", "Hero banner not found with id: " + id));
        banner.setActive(active);
        HeroBanner updated = bannerRepository.save(banner);
        log.info("Toggled hero banner active status: id={}, active={}", id, active);
        return BannerResponse.fromEntity(updated);
    }

    @Transactional
    public void deleteBanner(Long id) {
        HeroBanner banner = bannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BANNER_NOT_FOUND", "Hero banner not found with id: " + id));

        // Delete from Cloudinary if stored there
        if (banner.getCloudinaryPublicId() != null) {
            cloudinaryService.deleteBannerImage(banner.getCloudinaryPublicId());
        }
        if (banner.getImageUrl() != null && banner.getImageUrl().contains("cloudinary.com/")) {
            cloudinaryService.deleteFileByUrl(banner.getImageUrl());
        }

        bannerRepository.delete(banner);
        log.info("Deleted hero banner: id={}", id);
    }
}

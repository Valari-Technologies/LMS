package com.onetutor.banners.service;

import com.onetutor.banners.dto.PromoBannerRequest;
import com.onetutor.banners.dto.PromoBannerResponse;
import com.onetutor.banners.entity.PromoBanner;
import com.onetutor.banners.repository.PromoBannerRepository;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromoBannerService {

    private final PromoBannerRepository promoBannerRepository;

    @Transactional(readOnly = true)
    public PromoBannerResponse getActivePromoBanner() {
        return promoBannerRepository.findFirstByActiveTrueOrderByIdAsc()
                .map(PromoBannerResponse::fromEntity)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<PromoBannerResponse> getAllPromoBanners() {
        List<PromoBanner> list = promoBannerRepository.findAllByOrderByIdDesc();
        if (list.isEmpty()) {
            PromoBanner def = createDefaultPromoBanner();
            return List.of(PromoBannerResponse.fromEntity(def));
        }
        return list.stream().map(PromoBannerResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public PromoBannerResponse getPromoBannerById(Long id) {
        PromoBanner banner = promoBannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("PROMO_BANNER_NOT_FOUND", "Promo banner not found with ID: " + id));
        return PromoBannerResponse.fromEntity(banner);
    }

    @Transactional
    public PromoBannerResponse getAdminPromoBanner() {
        PromoBanner banner = promoBannerRepository.findTopByOrderByIdAsc()
                .orElseGet(this::createDefaultPromoBanner);
        return PromoBannerResponse.fromEntity(banner);
    }

    @Transactional
    public PromoBannerResponse createPromoBanner(PromoBannerRequest req) {
        validatePromoRequest(req);

        if (req.isActive()) {
            deactivateAllOtherBanners(null);
        }

        PromoBanner banner = PromoBanner.builder()
                .title(req.getTitle())
                .subtitle(req.getSubtitle())
                .bgColor(req.getBgColor() != null && !req.getBgColor().isBlank() ? req.getBgColor() : "#1c1d29")
                .textColor(req.getTextColor() != null && !req.getTextColor().isBlank() ? req.getTextColor() : "#ffffff")
                .accentColor(req.getAccentColor() != null && !req.getAccentColor().isBlank() ? req.getAccentColor() : "#a855f7")
                .imageUrl(req.getImageUrl())
                .secondaryImageUrl(req.getSecondaryImageUrl())
                .imageAlignment(req.getImageAlignment() != null && !req.getImageAlignment().isBlank() ? req.getImageAlignment() : "right")
                .ctaText(req.getCtaText() != null ? req.getCtaText() : "Subscribe now")
                .ctaLink(req.getCtaLink() != null ? req.getCtaLink() : "/student/courses")
                .ctaBgColor(req.getCtaBgColor() != null && !req.getCtaBgColor().isBlank() ? req.getCtaBgColor() : "#ffffff")
                .ctaTextColor(req.getCtaTextColor() != null && !req.getCtaTextColor().isBlank() ? req.getCtaTextColor() : "#1c1d29")
                .secondaryLinkText(req.getSecondaryLinkText())
                .secondaryLinkUrl(req.getSecondaryLinkUrl())
                .secondaryLinkColor(req.getSecondaryLinkColor() != null && !req.getSecondaryLinkColor().isBlank() ? req.getSecondaryLinkColor() : "#ffffff")
                .featuresJson(req.getFeaturesJson())
                .featuresColumns(req.getFeaturesColumns() != null ? req.getFeaturesColumns() : 2)
                .active(req.isActive())
                .build();

        PromoBanner saved = promoBannerRepository.save(banner);
        log.info("Created new promo banner (id: {}) with active = {}", saved.getId(), saved.isActive());
        return PromoBannerResponse.fromEntity(saved);
    }

    @Transactional
    public PromoBannerResponse updatePromoBannerById(Long id, PromoBannerRequest req) {
        validatePromoRequest(req);

        PromoBanner banner = promoBannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("PROMO_BANNER_NOT_FOUND", "Promo banner not found with ID: " + id));

        if (req.isActive() && !banner.isActive()) {
            deactivateAllOtherBanners(id);
        }

        applyRequestToEntity(req, banner);
        PromoBanner saved = promoBannerRepository.save(banner);
        log.info("Updated promo banner (id: {}) with active = {}", saved.getId(), saved.isActive());
        return PromoBannerResponse.fromEntity(saved);
    }

    @Transactional
    public void deletePromoBanner(Long id) {
        PromoBanner banner = promoBannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("PROMO_BANNER_NOT_FOUND", "Promo banner not found with ID: " + id));

        promoBannerRepository.delete(banner);
        log.info("Deleted promo banner with id: {}", id);

        if (promoBannerRepository.count() == 0) {
            createDefaultPromoBanner();
        }
    }

    @Transactional
    public PromoBannerResponse togglePromoBannerStatusById(Long id, boolean active) {
        PromoBanner banner = promoBannerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("PROMO_BANNER_NOT_FOUND", "Promo banner not found with ID: " + id));

        if (active) {
            deactivateAllOtherBanners(id);
        }
        banner.setActive(active);
        PromoBanner saved = promoBannerRepository.save(banner);
        log.info("Toggled promo banner (id: {}) active status to {}", saved.getId(), saved.isActive());
        return PromoBannerResponse.fromEntity(saved);
    }

    @Transactional
    public PromoBannerResponse togglePromoBannerStatus(boolean active) {
        PromoBanner banner = promoBannerRepository.findTopByOrderByIdAsc()
                .orElseGet(this::createDefaultPromoBanner);
        if (active) {
            deactivateAllOtherBanners(banner.getId());
        }
        banner.setActive(active);
        PromoBanner saved = promoBannerRepository.save(banner);
        log.info("Toggled promo banner (id: {}) active status to {}", saved.getId(), saved.isActive());
        return PromoBannerResponse.fromEntity(saved);
    }

    @Transactional
    public PromoBannerResponse updatePromoBanner(PromoBannerRequest req) {
        validatePromoRequest(req);
        PromoBanner banner = promoBannerRepository.findTopByOrderByIdAsc()
                .orElseGet(this::createDefaultPromoBanner);

        if (req.isActive() && !banner.isActive()) {
            deactivateAllOtherBanners(banner.getId());
        }

        applyRequestToEntity(req, banner);
        PromoBanner saved = promoBannerRepository.save(banner);
        log.info("Updated promo banner (id: {}) with active = {}", saved.getId(), saved.isActive());
        return PromoBannerResponse.fromEntity(saved);
    }

    private void validatePromoRequest(PromoBannerRequest req) {
        if (req.getImageUrl() != null && req.getImageUrl().startsWith("blob:")) {
            throw new BadRequestException("INVALID_IMAGE_URL", "Blob URLs cannot be saved. Please upload the image to Cloudinary first.");
        }
    }

    private void deactivateAllOtherBanners(Long currentId) {
        List<PromoBanner> all = promoBannerRepository.findAll();
        for (PromoBanner b : all) {
            if (currentId == null || !b.getId().equals(currentId)) {
                if (b.isActive()) {
                    b.setActive(false);
                    promoBannerRepository.save(b);
                }
            }
        }
    }

    private void applyRequestToEntity(PromoBannerRequest req, PromoBanner banner) {
        banner.setTitle(req.getTitle());
        banner.setSubtitle(req.getSubtitle());
        if (req.getBgColor() != null && !req.getBgColor().isBlank()) {
            banner.setBgColor(req.getBgColor());
        }
        if (req.getTextColor() != null && !req.getTextColor().isBlank()) {
            banner.setTextColor(req.getTextColor());
        }
        if (req.getAccentColor() != null && !req.getAccentColor().isBlank()) {
            banner.setAccentColor(req.getAccentColor());
        }
        banner.setImageUrl(req.getImageUrl());
        banner.setSecondaryImageUrl(req.getSecondaryImageUrl());
        if (req.getImageAlignment() != null && !req.getImageAlignment().isBlank()) {
            banner.setImageAlignment(req.getImageAlignment());
        }
        if (req.getCtaText() != null) banner.setCtaText(req.getCtaText());
        if (req.getCtaLink() != null) banner.setCtaLink(req.getCtaLink());
        if (req.getCtaBgColor() != null && !req.getCtaBgColor().isBlank()) {
            banner.setCtaBgColor(req.getCtaBgColor());
        }
        if (req.getCtaTextColor() != null && !req.getCtaTextColor().isBlank()) {
            banner.setCtaTextColor(req.getCtaTextColor());
        }
        if (req.getSecondaryLinkText() != null) banner.setSecondaryLinkText(req.getSecondaryLinkText());
        if (req.getSecondaryLinkUrl() != null) banner.setSecondaryLinkUrl(req.getSecondaryLinkUrl());
        if (req.getSecondaryLinkColor() != null && !req.getSecondaryLinkColor().isBlank()) {
            banner.setSecondaryLinkColor(req.getSecondaryLinkColor());
        }
        if (req.getFeaturesJson() != null) banner.setFeaturesJson(req.getFeaturesJson());
        if (req.getFeaturesColumns() != null) {
            banner.setFeaturesColumns(req.getFeaturesColumns());
        }
        banner.setActive(req.isActive());
    }

    private PromoBanner createDefaultPromoBanner() {
        PromoBanner defaultBanner = PromoBanner.builder()
                .title("Build your career with a Personal Plan subscription")
                .subtitle("Subscribers save an average of ₹4,000+ in their first month, stop paying per course. Join 5 lakh+ learners, starting at ₹500/month.")
                .bgColor("#1c1d29")
                .textColor("#ffffff")
                .accentColor("#a855f7")
                .imageUrl("https://res.cloudinary.com/q9yidryy/image/upload/v1791526803/onetutor/banners/file_skvq2c.png")
                .secondaryImageUrl("")
                .imageAlignment("right")
                .ctaText("Subscribe now")
                .ctaLink("/student/courses")
                .ctaBgColor("#ffffff")
                .ctaTextColor("#1c1d29")
                .secondaryLinkText("Learn more")
                .secondaryLinkUrl("/student/courses")
                .secondaryLinkColor("#ffffff")
                .featuresJson("[{\"icon\":\"star\",\"text\":\"Get access to 28,000+ top-rated courses\"},{\"icon\":\"lightbulb\",\"text\":\"Learn from 9,000+ expert instructors\"},{\"icon\":\"tv\",\"text\":\"Dev, IT, Business, Design and 50+ more topics\"},{\"icon\":\"trophy\",\"text\":\"Certification prep for AWS, Microsoft, PMI, and more\"}]")
                .featuresColumns(2)
                .active(true)
                .build();
        return promoBannerRepository.save(defaultBanner);
    }
}

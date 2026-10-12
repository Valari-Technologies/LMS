package com.onetutor.banners.controller;

import com.onetutor.banners.dto.BannerResponse;
import com.onetutor.banners.dto.PromoBannerResponse;
import com.onetutor.banners.service.HeroBannerService;
import com.onetutor.banners.service.PromoBannerService;
import com.onetutor.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/banners")
@RequiredArgsConstructor
@Tag(name = "Banners", description = "Public hero & promo banner endpoints")
public class PublicBannerController {

    private final HeroBannerService bannerService;
    private final PromoBannerService promoBannerService;

    @GetMapping("/active")
    @Operation(summary = "Get active hero banners for student home carousel")
    public ResponseEntity<ApiResponse<List<BannerResponse>>> getActiveBanners() {
        List<BannerResponse> banners = bannerService.getActiveBanners();
        return ResponseEntity.ok(ApiResponse.ok(banners));
    }

    @GetMapping("/promo")
    @Operation(summary = "Get active promo banner for student home page")
    public ResponseEntity<ApiResponse<PromoBannerResponse>> getActivePromoBanner() {
        PromoBannerResponse promo = promoBannerService.getActivePromoBanner();
        return ResponseEntity.ok(ApiResponse.ok(promo));
    }
}

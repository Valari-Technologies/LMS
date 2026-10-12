package com.onetutor.banners.controller;

import com.onetutor.banners.dto.BannerRequest;
import com.onetutor.banners.dto.BannerResponse;
import com.onetutor.banners.service.HeroBannerService;
import com.onetutor.media.service.CloudinaryService;
import com.onetutor.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/banners")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
@Tag(name = "Admin Hero Banners", description = "Admin CRUD operations for hero banners")
public class AdminBannerController {

    private final HeroBannerService bannerService;
    private final CloudinaryService cloudinaryService;
    private final com.onetutor.banners.service.PromoBannerService promoBannerService;

    // --- PROMO BANNER (Course Section Footer) ---

    @GetMapping("/promo")
    @Operation(summary = "Get current promo banner settings for admin configuration")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> getPromoBanner() {
        return ResponseEntity.ok(ApiResponse.ok(promoBannerService.getAdminPromoBanner()));
    }

    @GetMapping("/promo/all")
    @Operation(summary = "List all promo banners")
    public ResponseEntity<ApiResponse<List<com.onetutor.banners.dto.PromoBannerResponse>>> getAllPromoBanners() {
        return ResponseEntity.ok(ApiResponse.ok(promoBannerService.getAllPromoBanners()));
    }

    @GetMapping("/promo/{id}")
    @Operation(summary = "Get promo banner by ID")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> getPromoBannerById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(promoBannerService.getPromoBannerById(id)));
    }

    @PostMapping("/promo")
    @Operation(summary = "Create a new promo banner")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> createPromoBanner(
            @Valid @RequestBody com.onetutor.banners.dto.PromoBannerRequest req) {
        com.onetutor.banners.dto.PromoBannerResponse created = promoBannerService.createPromoBanner(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Promo banner created successfully", created));
    }

    @PutMapping("/promo")
    @Operation(summary = "Update active promo banner settings")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> updatePromoBanner(
            @Valid @RequestBody com.onetutor.banners.dto.PromoBannerRequest req) {
        com.onetutor.banners.dto.PromoBannerResponse updated = promoBannerService.updatePromoBanner(req);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner updated successfully", updated));
    }

    @PutMapping("/promo/{id}")
    @Operation(summary = "Update promo banner by ID")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> updatePromoBannerById(
            @PathVariable Long id,
            @Valid @RequestBody com.onetutor.banners.dto.PromoBannerRequest req) {
        com.onetutor.banners.dto.PromoBannerResponse updated = promoBannerService.updatePromoBannerById(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner updated successfully", updated));
    }

    @DeleteMapping("/promo/{id}")
    @Operation(summary = "Delete promo banner by ID")
    public ResponseEntity<ApiResponse<Void>> deletePromoBanner(@PathVariable Long id) {
        promoBannerService.deletePromoBanner(id);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner deleted successfully", null));
    }

    @PatchMapping("/promo/status")
    @Operation(summary = "Toggle promo banner active status")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> togglePromoBannerStatus(
            @RequestParam boolean active) {
        com.onetutor.banners.dto.PromoBannerResponse updated = promoBannerService.togglePromoBannerStatus(active);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner status updated successfully", updated));
    }

    @PatchMapping("/promo/{id}/status")
    @Operation(summary = "Toggle promo banner active status by ID")
    public ResponseEntity<ApiResponse<com.onetutor.banners.dto.PromoBannerResponse>> togglePromoBannerStatusById(
            @PathVariable Long id,
            @RequestParam boolean active) {
        com.onetutor.banners.dto.PromoBannerResponse updated = promoBannerService.togglePromoBannerStatusById(id, active);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner status updated successfully", updated));
    }

    @PostMapping("/promo/upload")
    @Operation(summary = "Upload promo banner image to Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadPromoImage(@RequestParam("file") MultipartFile file) throws IOException {
        Map<String, String> uploadResult = cloudinaryService.uploadBannerImage(file);
        return ResponseEntity.ok(ApiResponse.ok("Promo banner image uploaded successfully to Cloudinary", uploadResult));
    }

    // --- HERO BANNERS (Top Carousel) ---

    @GetMapping
    @Operation(summary = "List all hero banners")
    public ResponseEntity<ApiResponse<List<BannerResponse>>> getAllBanners() {
        return ResponseEntity.ok(ApiResponse.ok(bannerService.getAllBanners()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get hero banner by ID")
    public ResponseEntity<ApiResponse<BannerResponse>> getBanner(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(bannerService.getBanner(id)));
    }

    @PostMapping("/upload")
    @Operation(summary = "Upload banner image to Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        Map<String, String> uploadResult = cloudinaryService.uploadBannerImage(file);
        return ResponseEntity.ok(ApiResponse.ok("Image uploaded successfully to Cloudinary", uploadResult));
    }

    @PostMapping
    @Operation(summary = "Create a new hero banner")
    public ResponseEntity<ApiResponse<BannerResponse>> createBanner(@Valid @RequestBody BannerRequest req) {
        BannerResponse created = bannerService.createBanner(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Hero banner created successfully", created));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing hero banner")
    public ResponseEntity<ApiResponse<BannerResponse>> updateBanner(
            @PathVariable Long id,
            @Valid @RequestBody BannerRequest req) {
        BannerResponse updated = bannerService.updateBanner(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Hero banner updated successfully", updated));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Toggle hero banner active/inactive status")
    public ResponseEntity<ApiResponse<BannerResponse>> toggleStatus(
            @PathVariable Long id,
            @RequestParam boolean active) {
        BannerResponse updated = bannerService.toggleBannerStatus(id, active);
        return ResponseEntity.ok(ApiResponse.ok("Banner status updated", updated));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete hero banner")
    public ResponseEntity<ApiResponse<Void>> deleteBanner(@PathVariable Long id) {
        bannerService.deleteBanner(id);
        return ResponseEntity.ok(ApiResponse.ok("Hero banner deleted successfully", null));
    }
}

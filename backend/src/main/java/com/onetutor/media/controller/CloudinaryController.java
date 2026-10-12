package com.onetutor.media.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.media.service.CloudinaryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Dedicated REST Controller for direct Cloudinary CRUD Operations.
 * Supports all media and document files (Images, Videos, Audio, PDFs, Office Documents, Archives).
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Cloudinary Operations", description = "Direct CRUD APIs for Cloudinary asset management")
@Slf4j
public class CloudinaryController {

    private final CloudinaryService cloudinaryService;

    public CloudinaryController(CloudinaryService cloudinaryService) {
        this.cloudinaryService = cloudinaryService;
    }

    /**
     * CREATE (Upload): Uploads any image, document, video, or audio file directly to Cloudinary.
     */
    @PostMapping("/admin/cloudinary/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Operation(summary = "Upload file/document directly to Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "media") String folder) throws IOException {

        Map<String, Object> result = cloudinaryService.uploadFile(file, folder);
        return ResponseEntity.ok(ApiResponse.ok("File uploaded to Cloudinary successfully", result));
    }

    /**
     * User/Student upload endpoint for community messages and course attachments.
     */
    @PostMapping("/cloudinary/upload")
    @Operation(summary = "Upload community/course attachment to Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadForUser(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "community") String folder) throws IOException {

        Map<String, Object> result = cloudinaryService.uploadFile(file, folder);
        return ResponseEntity.ok(ApiResponse.ok("File uploaded to Cloudinary successfully", result));
    }

    /**
     * READ: Fetches live asset metadata from Cloudinary API.
     */
    @GetMapping("/admin/cloudinary/details")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Operation(summary = "Get Cloudinary asset metadata by public_id")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDetails(
            @RequestParam("publicId") String publicId,
            @RequestParam(value = "resourceType", required = false) String resourceType) {

        Map<String, Object> details = cloudinaryService.getAssetDetails(publicId, resourceType);
        if (details == null || details.isEmpty()) {
            throw new com.onetutor.common.exceptions.NotFoundException("ASSET_NOT_FOUND", "Asset not found in Cloudinary");
        }
        return ResponseEntity.ok(ApiResponse.ok("Cloudinary asset retrieved successfully", details));
    }

    /**
     * UPDATE: Replaces an existing file in Cloudinary with a newly uploaded file.
     */
    @PutMapping("/admin/cloudinary/replace")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Operation(summary = "Replace an existing file on Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> replace(
            @RequestParam(value = "oldPublicId", required = false) String oldPublicId,
            @RequestParam(value = "oldUrl", required = false) String oldUrl,
            @RequestParam(value = "oldResourceType", required = false) String oldResourceType,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "media") String folder) throws IOException {

        Map<String, Object> result;
        if (oldUrl != null && !oldUrl.isBlank()) {
            result = cloudinaryService.replaceFileByUrl(oldUrl, file, folder);
        } else {
            result = cloudinaryService.replaceFile(oldPublicId, oldResourceType, file, folder);
        }
        return ResponseEntity.ok(ApiResponse.ok("File replaced on Cloudinary successfully", result));
    }

    /**
     * DELETE: Permanently destroys an asset from Cloudinary.
     */
    @DeleteMapping("/admin/cloudinary")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    @Operation(summary = "Delete an asset permanently from Cloudinary")
    public ResponseEntity<ApiResponse<Void>> delete(
            @RequestParam(value = "publicId", required = false) String publicId,
            @RequestParam(value = "resourceType", required = false) String resourceType,
            @RequestParam(value = "url", required = false) String url) {

        boolean deleted = false;
        if (url != null && !url.isBlank()) {
            deleted = cloudinaryService.deleteFileByUrl(url);
        } else if (publicId != null && !publicId.isBlank()) {
            deleted = cloudinaryService.deleteFile(publicId, resourceType);
        }

        if (deleted) {
            return ResponseEntity.ok(ApiResponse.ok("Asset deleted from Cloudinary successfully", null));
        } else {
            return ResponseEntity.ok(ApiResponse.ok("Asset removal completed (asset was deleted or not found)", null));
        }
    }
}

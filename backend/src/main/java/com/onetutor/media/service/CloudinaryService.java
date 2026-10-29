package com.onetutor.media.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Enterprise Cloudinary Service providing full CRUD operations for all media
 * and document types (Images, Videos, Audio, PDFs, Office Documents, Archives).
 */
@Service
@Slf4j
public class CloudinaryService {

    private final Cloudinary cloudinary;
    private final boolean isConfigured;

    public CloudinaryService(
            @Value("${app.cloudinary.cloud-name:q9yidryy}") String cloudName,
            @Value("${app.cloudinary.api-key:148762832864723}") String apiKey,
            @Value("${app.cloudinary.api-secret:KprNV5T5a7TKDMDFjmO_tQIWvX4}") String apiSecret) {

        if (apiKey != null && !apiKey.isBlank() && apiSecret != null && !apiSecret.isBlank()) {
            this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName,
                    "api_key", apiKey,
                    "api_secret", apiSecret,
                    "secure", true,
                    "timeout", 300,
                    "connection_timeout", 60
            ));
            this.isConfigured = true;
            log.info("[Cloudinary] Configured successfully for cloud_name: {}", cloudName);
        } else {
            this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName,
                    "secure", true
            ));
            this.isConfigured = false;
            log.info("[Cloudinary] API credentials not fully set; will fallback to local storage for general media uploads");
        }
    }

    public boolean isConfigured() {
        return isConfigured;
    }

    public Cloudinary getCloudinary() {
        return cloudinary;
    }

    // ==========================================
    // 1. CREATE OPERATIONS (UPLOAD)
    // ==========================================

    /**
     * Uploads an image, video, audio, or document file (PDF, Word, Excel, PPT, Zip, etc.) to Cloudinary.
     * Returns a Map containing: "url", "public_id", "resource_type", "format", "bytes", "original_filename", "created_at"
     */
    public Map<String, Object> uploadFile(MultipartFile file, String subfolder) throws IOException {
        if (!isConfigured) {
            throw new IllegalStateException("Cloudinary is not configured with API key and secret");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty or null file");
        }

        String mimeType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String lowerName = originalName.toLowerCase();

        String resourceType = determineResourceType(mimeType, lowerName);

        Map<String, Object> options = new HashMap<>();
        String targetFolder = "onetutor/" + (subfolder != null && !subfolder.isBlank() ? subfolder : "media");
        options.put("folder", targetFolder);
        options.put("resource_type", resourceType);
        options.put("access_mode", "public");
        options.put("overwrite", true);
        options.put("colors", false);
        options.put("faces", false);
        options.put("quality_analysis", false);
        options.put("phash", false);
        options.put("eager_async", true);

        if ("raw".equals(resourceType)) {
            // For raw documents (PDF, Word, Excel, ZIP), include clean name with extension in public_id
            String safeBaseName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String safePublicId = UUID.randomUUID().toString() + "_" + safeBaseName;
            options.put("public_id", safePublicId);
        } else {
            options.put("use_filename", true);
            options.put("unique_filename", true);
        }

        if ("image".equals(resourceType)) {
            options.put("quality", "auto");
            options.put("fetch_format", "auto");
        }

        // Check file size against safety limit (500MB)
        if (file.getSize() > 500L * 1024 * 1024) {
            log.warn("[Cloudinary] File size ({} MB) exceeds maximum 500MB limit.", file.getSize() / (1024 * 1024));
            throw new IllegalArgumentException("File size exceeds maximum 500MB limit (" + (file.getSize() / (1024 * 1024)) + "MB)");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> uploadResult;

        // Use high-performance chunked upload for videos or files > 6MB
        if (file.getSize() > 6 * 1024 * 1024 || "video".equals(resourceType)) {
            log.info("[Cloudinary] Uploading large file/video using chunked upload ({} bytes)...", file.getSize());
            options.put("chunk_size", 6 * 1024 * 1024); // 6MB chunk size
            Path tempFile = Files.createTempFile("cloudinary_up_", "_" + originalName.replaceAll("[^a-zA-Z0-9._-]", "_"));
            try {
                try (var in = file.getInputStream()) {
                    Files.copy(in, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                uploadResult = cloudinary.uploader().uploadLarge(tempFile.toFile(), options);
            } finally {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {}
            }
        } else {
            uploadResult = cloudinary.uploader().upload(file.getBytes(), options);
        }

        String secureUrl = (String) uploadResult.get("secure_url");
        if (secureUrl == null) {
            secureUrl = (String) uploadResult.get("url");
        }
        String publicId = (String) uploadResult.get("public_id");

        Map<String, Object> result = new HashMap<>();
        result.put("url", secureUrl);
        result.put("public_id", publicId);
        result.put("resource_type", resourceType);
        result.put("format", uploadResult.get("format"));
        result.put("bytes", uploadResult.get("bytes"));
        result.put("original_filename", originalName);
        result.put("created_at", uploadResult.get("created_at"));

        log.info("[Cloudinary] Created/Uploaded {} ({}) -> {}", originalName, resourceType, secureUrl);
        return result;
    }

    /**
     * Uploads in-memory byte array (e.g. generated VTT subtitles, documents, exports) directly to Cloudinary.
     */
    public Map<String, Object> uploadBytes(byte[] fileBytes, String originalName, String mimeType, String subfolder) throws IOException {
        if (!isConfigured) {
            throw new IllegalStateException("Cloudinary is not configured with API key and secret");
        }
        if (fileBytes == null || fileBytes.length == 0) {
            throw new IllegalArgumentException("Cannot upload empty byte array");
        }

        String safeOriginalName = (originalName != null && !originalName.isBlank()) ? originalName : "file";
        String lowerName = safeOriginalName.toLowerCase();
        String safeMime = (mimeType != null) ? mimeType.toLowerCase() : "";
        String resourceType = determineResourceType(safeMime, lowerName);

        Map<String, Object> options = new HashMap<>();
        String targetFolder = "onetutor/" + (subfolder != null && !subfolder.isBlank() ? subfolder : "media");
        options.put("folder", targetFolder);
        options.put("resource_type", resourceType);
        options.put("access_mode", "public");
        options.put("overwrite", true);

        if ("raw".equals(resourceType)) {
            String safePublicId = UUID.randomUUID().toString() + "_" + safeOriginalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            options.put("public_id", safePublicId);
        } else {
            options.put("use_filename", true);
            options.put("unique_filename", true);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> uploadResult = cloudinary.uploader().upload(fileBytes, options);

        String secureUrl = (String) uploadResult.get("secure_url");
        if (secureUrl == null) {
            secureUrl = (String) uploadResult.get("url");
        }
        String publicId = (String) uploadResult.get("public_id");

        Map<String, Object> result = new HashMap<>();
        result.put("url", secureUrl);
        result.put("public_id", publicId);
        result.put("resource_type", resourceType);
        result.put("format", uploadResult.get("format"));
        result.put("bytes", uploadResult.get("bytes"));
        result.put("original_filename", safeOriginalName);
        result.put("created_at", uploadResult.get("created_at"));

        log.info("[Cloudinary] Uploaded byte content {} ({}) -> {}", safeOriginalName, resourceType, secureUrl);
        return result;
    }

    /**
     * Uploads hero banner image to Cloudinary (banners subfolder).
     */
    public Map<String, String> uploadBannerImage(MultipartFile file) throws IOException {
        Map<String, Object> res = uploadFile(file, "banners");
        Map<String, String> out = new HashMap<>();
        out.put("url", (String) res.get("url"));
        out.put("public_id", (String) res.get("public_id"));
        return out;
    }

    // ==========================================
    // 2. READ OPERATIONS (DETAILS / GET / EXISTS)
    // ==========================================

    /**
     * Retrieves live metadata and details for an asset directly from Cloudinary Admin API.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getAssetDetails(String publicId, String resourceType) {
        if (!isConfigured || publicId == null || publicId.isBlank()) {
            return null;
        }

        List<String> typesToTry = getCandidateTypes(resourceType);
        for (String type : typesToTry) {
            try {
                Map<String, Object> details = (Map<String, Object>) cloudinary.api().resource(publicId, ObjectUtils.asMap("resource_type", type));
                if (details != null && !details.isEmpty()) {
                    return details;
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    /**
     * Checks if a public_id exists in Cloudinary.
     */
    public boolean exists(String publicId, String resourceType) {
        return getAssetDetails(publicId, resourceType) != null;
    }

    /**
     * Checks if a Cloudinary CDN URL exists.
     */
    public boolean existsByUrl(String url) {
        if (url == null || !url.contains("cloudinary.com/")) {
            return false;
        }
        Map<String, String> parsed = parseCloudinaryUrl(url);
        if (parsed != null) {
            return exists(parsed.get("public_id"), parsed.get("resource_type"));
        }
        return false;
    }

    // ==========================================
    // 3. UPDATE OPERATIONS (REPLACE)
    // ==========================================

    /**
     * Replaces an existing Cloudinary asset with a newly uploaded file.
     * Deletes the old file after successful upload.
     */
    public Map<String, Object> replaceFile(String oldPublicId, String oldResourceType, MultipartFile newFile, String subfolder) throws IOException {
        // 1. Upload the new file first
        Map<String, Object> uploadResult = uploadFile(newFile, subfolder);

        // 2. Destroy the old asset on Cloudinary
        if (oldPublicId != null && !oldPublicId.isBlank() && !oldPublicId.startsWith("local_")) {
            deleteFile(oldPublicId, oldResourceType);
        }

        log.info("[Cloudinary] Replaced asset oldPublicId={} with newPublicId={}", oldPublicId, uploadResult.get("public_id"));
        return uploadResult;
    }

    /**
     * Replaces an asset given its previous Cloudinary URL.
     */
    public Map<String, Object> replaceFileByUrl(String oldUrl, MultipartFile newFile, String subfolder) throws IOException {
        Map<String, String> parsed = parseCloudinaryUrl(oldUrl);
        String oldPublicId = parsed != null ? parsed.get("public_id") : null;
        String oldResourceType = parsed != null ? parsed.get("resource_type") : null;
        return replaceFile(oldPublicId, oldResourceType, newFile, subfolder);
    }

    // ==========================================
    // 4. DELETE OPERATIONS (DESTROY)
    // ==========================================

    /**
     * Permanently deletes a file from Cloudinary by public ID.
     * Uses multi-type fallback (raw, image, video) to guarantee deletion.
     */
    public boolean deleteFile(String publicId, String resourceType) {
        if (publicId == null || publicId.isBlank() || publicId.startsWith("local_")) {
            return false;
        }
        if (!isConfigured) {
            return false;
        }

        List<String> typesToTry = getCandidateTypes(resourceType);

        for (String type : typesToTry) {
            try {
                Map<?, ?> destroyResult = cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", type));
                String result = destroyResult != null && destroyResult.get("result") != null
                        ? destroyResult.get("result").toString() : "";
                if ("ok".equalsIgnoreCase(result)) {
                    log.info("[Cloudinary] Successfully destroyed asset (publicId: {}, resource_type: {})", publicId, type);
                    return true;
                }
            } catch (Exception e) {
                log.debug("[Cloudinary] Destroy attempt failed for publicId {} with type {}: {}", publicId, type, e.getMessage());
            }
        }

        // If publicId had or didn't have extension, try opposite for raw/image
        if (publicId.contains(".")) {
            String idWithoutExt = publicId.substring(0, publicId.lastIndexOf('.'));
            for (String type : typesToTry) {
                try {
                    Map<?, ?> destroyResult = cloudinary.uploader().destroy(idWithoutExt, ObjectUtils.asMap("resource_type", type));
                    String result = destroyResult != null && destroyResult.get("result") != null
                            ? destroyResult.get("result").toString() : "";
                    if ("ok".equalsIgnoreCase(result)) {
                        log.info("[Cloudinary] Successfully destroyed asset without extension (publicId: {}, resource_type: {})", idWithoutExt, type);
                        return true;
                    }
                } catch (Exception ignored) {}
            }
        }

        log.warn("[Cloudinary] Could not destroy asset (publicId: {}). It may have already been removed.", publicId);
        return false;
    }

    /**
     * Permanently deletes a file from Cloudinary given its full CDN URL.
     */
    public boolean deleteFileByUrl(String url) {
        if (url == null || url.isBlank()) return false;
        Map<String, String> parsed = parseCloudinaryUrl(url);
        if (parsed != null) {
            return deleteFile(parsed.get("public_id"), parsed.get("resource_type"));
        }
        return false;
    }

    /**
     * Deletes multiple assets from Cloudinary in batch.
     */
    @SuppressWarnings("unchecked")
    public boolean deleteMultiple(List<String> publicIds, String resourceType) {
        if (!isConfigured || publicIds == null || publicIds.isEmpty()) return false;
        try {
            String type = (resourceType != null && !resourceType.isBlank()) ? resourceType : "image";
            cloudinary.api().deleteResources(publicIds, ObjectUtils.asMap("resource_type", type));
            log.info("[Cloudinary] Batch deleted {} assets of type {}", publicIds.size(), type);
            return true;
        } catch (Exception e) {
            log.warn("[Cloudinary] Failed batch delete: {}", e.getMessage());
            return false;
        }
    }

    public void deleteBannerImage(String publicId) {
        deleteFile(publicId, "image");
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Determines whether an asset should be categorized as "image", "video", or "raw".
     */
    public String determineResourceType(String mimeType, String lowerFilename) {
        if (mimeType == null) mimeType = "";
        if (lowerFilename == null) lowerFilename = "";

        // Images
        if (mimeType.startsWith("image/")
                || lowerFilename.endsWith(".png") || lowerFilename.endsWith(".jpg")
                || lowerFilename.endsWith(".jpeg") || lowerFilename.endsWith(".webp")
                || lowerFilename.endsWith(".gif") || lowerFilename.endsWith(".svg")
                || lowerFilename.endsWith(".bmp") || lowerFilename.endsWith(".ico")
                || lowerFilename.endsWith(".tiff") || lowerFilename.endsWith(".avif")) {
            return "image";
        }

        // Videos and Audios
        if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")
                || lowerFilename.endsWith(".mp4") || lowerFilename.endsWith(".webm")
                || lowerFilename.endsWith(".mov") || lowerFilename.endsWith(".avi")
                || lowerFilename.endsWith(".mkv") || lowerFilename.endsWith(".mp3")
                || lowerFilename.endsWith(".wav") || lowerFilename.endsWith(".ogg")
                || lowerFilename.endsWith(".m4a") || lowerFilename.endsWith(".aac")
                || lowerFilename.endsWith(".flac")) {
            return "video";
        }

        // Documents, PDFs, Spreadsheets, Presentations, Archives, Text, Code
        return "raw";
    }

    /**
     * Extracts the public_id and resource_type from a Cloudinary URL.
     */
    public Map<String, String> parseCloudinaryUrl(String url) {
        if (url == null || !url.contains("cloudinary.com/")) {
            return null;
        }
        try {
            int cloudIdx = url.indexOf("cloudinary.com/");
            String path = url.substring(cloudIdx + "cloudinary.com/".length());
            String[] parts = path.split("/");
            if (parts.length < 4) return null;

            String resourceType = parts[1]; // image, video, raw

            int uploadIdx = url.indexOf("/upload/");
            if (uploadIdx == -1) return null;
            String afterUpload = url.substring(uploadIdx + "/upload/".length());

            // Remove transformation flags if present (e.g. s--...--/ or c_scale,w_500/)
            if (afterUpload.startsWith("s--")) {
                int nextSlash = afterUpload.indexOf('/');
                if (nextSlash != -1) {
                    afterUpload = afterUpload.substring(nextSlash + 1);
                }
            }

            // Remove version tag if present: v1234567/
            if (afterUpload.matches("^v[0-9]+/.+")) {
                afterUpload = afterUpload.substring(afterUpload.indexOf('/') + 1);
            }

            String publicId = afterUpload;
            // For images and videos, remove extension from publicId
            if (!"raw".equalsIgnoreCase(resourceType)) {
                int lastDot = publicId.lastIndexOf('.');
                if (lastDot > 0) {
                    publicId = publicId.substring(0, lastDot);
                }
            }

            Map<String, String> result = new HashMap<>();
            result.put("resource_type", resourceType);
            result.put("public_id", publicId);
            return result;
        } catch (Exception e) {
            log.warn("[Cloudinary] Could not parse URL: {}", url);
            return null;
        }
    }

    private List<String> getCandidateTypes(String preferredType) {
        List<String> list = new ArrayList<>();
        if (preferredType != null && !preferredType.isBlank()) {
            list.add(preferredType.toLowerCase());
        }
        for (String t : List.of("image", "raw", "video")) {
            if (!list.contains(t)) {
                list.add(t);
            }
        }
        return list;
    }
}

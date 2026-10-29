package com.onetutor.media.service;

import com.onetutor.audit.service.AuditService;
import com.onetutor.common.PageResponse;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.media.dto.MediaAssetResponse;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.media.repository.MediaAssetRepository;
import com.onetutor.users.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.Map;

@Service
@Transactional
@Slf4j
public class MediaService {

    private final MediaAssetRepository mediaAssetRepository;
    private final StorageService storageService;
    private final CloudinaryService cloudinaryService;
    private final AuditService auditService;

    public MediaService(MediaAssetRepository mediaAssetRepository,
                        StorageService storageService,
                        CloudinaryService cloudinaryService,
                        AuditService auditService) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.storageService = storageService;
        this.cloudinaryService = cloudinaryService;
        this.auditService = auditService;
    }

    /**
     * Create / Upload asset directly to Cloudinary (with fallback to storageService).
     * Supports images, videos, audio, PDFs, Word, Excel, PowerPoint, archives, text, etc.
     */
    @Transactional
    public MediaAssetResponse upload(MultipartFile file, User actor) {
        String rawOriginalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String mimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String lowerName = rawOriginalName.toLowerCase();

        String fileType = detectFileType(mimeType, lowerName);
        String storagePath = null;
        String thumbnailPath = null;

        // Upload directly to Cloudinary
        if (cloudinaryService.isConfigured()) {
            try {
                Map<String, Object> cRes = cloudinaryService.uploadFile(file, "media");
                storagePath = (String) cRes.get("url");
                thumbnailPath = (String) cRes.get("public_id");
                log.info("[MediaService] File stored on Cloudinary CDN: {}", storagePath);
            } catch (Exception e) {
                log.warn("[MediaService] Cloudinary upload failed ({}), routing to primary storage provider.", e.getMessage());
            }
        }

        // Storage provider fallback
        if (storagePath == null) {
            storagePath = storageService.upload(file, "media");
        }

        MediaAsset asset = new MediaAsset();
        asset.setFileName(rawOriginalName);
        asset.setOriginalName(rawOriginalName);
        asset.setFileType(fileType);
        asset.setMimeType(mimeType);
        asset.setFileSize(file.getSize());
        asset.setStoragePath(storagePath);
        asset.setThumbnailPath(thumbnailPath);
        asset.setStatus("active");
        asset.setUploadedBy(actor);

        mediaAssetRepository.save(asset);

        auditService.log(actor, "UPLOAD_MEDIA", "MediaAsset", asset.getId(),
                "Uploaded media: " + asset.getFileName() + " (" + asset.getFileSize() + " bytes)");

        return MediaAssetResponse.from(asset);
    }

    /**
     * Read / List assets with pagination and search.
     */
    @Transactional
    public PageResponse<MediaAssetResponse> list(String search, Pageable pageable) {
        Page<MediaAsset> page;
        if (search != null && !search.isBlank()) {
            page = mediaAssetRepository.searchActive(search.trim(), pageable);
        } else {
            page = mediaAssetRepository.findByStatusOrderByCreatedAtDesc("active", pageable);
        }
        for (MediaAsset asset : page.getContent()) {
            if (asset.getStoragePath() != null && !asset.getStoragePath().startsWith("http")) {
                ensureCloudinaryStorage(asset);
            }
        }
        return PageResponse.from(page.map(MediaAssetResponse::from));
    }

    @Transactional(readOnly = true)
    public MediaAsset findOrThrow(Long id) {
        return mediaAssetRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("MEDIA_NOT_FOUND", "Media asset not found"));
    }

    @Transactional
    public Resource loadAsResource(Long id) {
        MediaAsset asset = findOrThrow(id);
        String path = asset.getStoragePath();
        if (path != null && (path.startsWith("http://") || path.startsWith("https://"))) {
            try {
                return new UrlResource(URI.create(path));
            } catch (Exception e) {
                log.warn("[MediaService] Failed to load URL as resource: {}", path);
            }
        }

        if (asset.getStoragePath() != null && !storageService.exists(asset.getStoragePath()) && asset.getFilename() != null) {
            String filename = asset.getFilename();
            String cleanName = filename.contains(".") ? filename.substring(0, filename.lastIndexOf('.')) : filename;
            java.nio.file.Path uploadsMedia = java.nio.file.Paths.get("./uploads/media").toAbsolutePath().normalize();
            if (java.nio.file.Files.exists(uploadsMedia)) {
                try (var stream = java.nio.file.Files.list(uploadsMedia)) {
                    java.nio.file.Path match = stream.filter(p -> {
                        String name = p.getFileName().toString().toLowerCase();
                        return name.contains("mern") || (cleanName.length() > 2 && name.contains(cleanName.toLowerCase()));
                    }).findFirst().orElse(null);
                    if (match != null) {
                        String newPath = "media/" + match.getFileName().toString();
                        log.info("[MediaService] Auto-healed missing storagePath for media asset #{}: old='{}', new='{}'", id, asset.getStoragePath(), newPath);
                        asset.setStoragePath(newPath);
                        mediaAssetRepository.save(asset);
                    }
                } catch (Exception e) {
                    log.warn("[MediaService] Failed to auto-heal storage path for media asset #{}: {}", id, e.getMessage());
                }
            }
        }
        return storageService.loadAsResource(asset.getStoragePath());
    }

    /**
     * Ensures an asset is stored on Cloudinary.
     * If the asset was previously saved to local disk, uploads it to Cloudinary and saves the URL.
     */
    @Transactional
    public String ensureCloudinaryStorage(MediaAsset asset) {
        if (asset == null) return null;
        String path = asset.getStoragePath();
        if (path != null && (path.startsWith("http://") || path.startsWith("https://"))) {
            return path;
        }
        if (cloudinaryService.isConfigured()) {
            try {
                Resource resource = loadAsResource(asset.getId());
                if (resource != null && resource.exists()) {
                    byte[] bytes;
                    try (var in = resource.getInputStream()) {
                        bytes = in.readAllBytes();
                    }
                    if (bytes.length > 0) {
                        Map<String, Object> cRes = cloudinaryService.uploadBytes(bytes, asset.getOriginalName(), asset.getMimeType(), "media");
                        String secureUrl = (String) cRes.get("url");
                        String publicId = (String) cRes.get("public_id");
                        if (secureUrl != null && !secureUrl.isBlank()) {
                            asset.setStoragePath(secureUrl);
                            asset.setThumbnailPath(publicId);
                            mediaAssetRepository.save(asset);
                            log.info("[MediaService] Auto-migrated local asset #{} ({}) to Cloudinary: {}", asset.getId(), asset.getFileName(), secureUrl);
                            return secureUrl;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[MediaService] Auto-migration to Cloudinary failed for asset #{}: {}", asset.getId(), e.getMessage());
            }
        }
        return asset.getStoragePath();
    }

    /**
     * Update asset metadata or replace media file in Cloudinary & DB.
     */
    @Transactional
    public MediaAssetResponse update(Long id, String newName, MultipartFile newFile, User actor) {
        MediaAsset asset = findOrThrow(id);

        if (newName != null && !newName.isBlank()) {
            asset.setFileName(newName.trim());
            asset.setOriginalName(newName.trim());
        }

        if (newFile != null && !newFile.isEmpty()) {
            String mimeType = newFile.getContentType() != null ? newFile.getContentType() : "application/octet-stream";
            String lowerName = (newFile.getOriginalFilename() != null ? newFile.getOriginalFilename() : "").toLowerCase();
            String fileType = detectFileType(mimeType, lowerName);

            // Delete old asset from Cloudinary
            if (asset.getThumbnailPath() != null && !asset.getThumbnailPath().startsWith("local_")) {
                String resourceType = determineResourceTypeForAsset(asset);
                cloudinaryService.deleteFile(asset.getThumbnailPath(), resourceType);
            }
            if (asset.getStoragePath() != null && asset.getStoragePath().contains("cloudinary.com/")) {
                cloudinaryService.deleteFileByUrl(asset.getStoragePath());
            }

            String newStoragePath = null;
            String newPublicId = null;

            if (cloudinaryService.isConfigured()) {
                try {
                    Map<String, Object> cRes = cloudinaryService.uploadFile(newFile, "media");
                    newStoragePath = (String) cRes.get("url");
                    newPublicId = (String) cRes.get("public_id");
                } catch (Exception e) {
                    log.warn("[MediaService] Cloudinary update upload failed, using storage provider fallback: {}", e.getMessage());
                }
            }

            if (newStoragePath == null) {
                newStoragePath = storageService.upload(newFile, "media");
            }

            asset.setFileType(fileType);
            asset.setMimeType(mimeType);
            asset.setFileSize(newFile.getSize());
            asset.setStoragePath(newStoragePath);
            asset.setThumbnailPath(newPublicId);
        }

        mediaAssetRepository.save(asset);

        auditService.log(actor, "UPDATE_MEDIA", "MediaAsset", asset.getId(),
                "Updated media asset: " + asset.getFileName());

        return MediaAssetResponse.from(asset);
    }

    /**
     * Delete / Archive asset from Cloudinary and DB.
     */
    @Transactional
    public void delete(Long id, User actor) {
        MediaAsset asset = findOrThrow(id);

        // Delete from Cloudinary by public_id
        if (asset.getThumbnailPath() != null && !asset.getThumbnailPath().startsWith("local_")) {
            String resourceType = determineResourceTypeForAsset(asset);
            cloudinaryService.deleteFile(asset.getThumbnailPath(), resourceType);
        }

        // Delete from Cloudinary by URL
        if (asset.getStoragePath() != null && asset.getStoragePath().contains("cloudinary.com/")) {
            cloudinaryService.deleteFileByUrl(asset.getStoragePath());
        }

        asset.setStatus("archived");
        mediaAssetRepository.save(asset);

        auditService.log(actor, "ARCHIVE_MEDIA", "MediaAsset", id,
                "Archived media asset: " + asset.getFileName());
    }

    private String detectFileType(String mimeType, String lowerName) {
        if (mimeType.startsWith("video/") || lowerName.endsWith(".mp4") || lowerName.endsWith(".webm") || lowerName.endsWith(".mkv") || lowerName.endsWith(".mov")) {
            return "video";
        } else if (mimeType.startsWith("image/") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".webp") || lowerName.endsWith(".gif") || lowerName.endsWith(".svg")) {
            return "image";
        } else if (mimeType.startsWith("audio/") || lowerName.endsWith(".mp3") || lowerName.endsWith(".wav") || lowerName.endsWith(".ogg") || lowerName.endsWith(".m4a")) {
            return "audio";
        } else if (mimeType.equals("application/pdf") || lowerName.endsWith(".pdf")) {
            return "pdf";
        } else if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx") || mimeType.contains("word")) {
            return "word";
        } else if (lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv") || mimeType.contains("excel") || mimeType.contains("spreadsheet")) {
            return "excel";
        } else if (lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx") || mimeType.contains("presentation") || mimeType.contains("powerpoint")) {
            return "powerpoint";
        } else if (mimeType.contains("zip") || lowerName.endsWith(".zip") || lowerName.endsWith(".rar") || lowerName.endsWith(".7z") || lowerName.endsWith(".tar") || lowerName.endsWith(".gz")) {
            return "zip";
        } else if (mimeType.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
            return "document";
        }
        return "file";
    }

    private String determineResourceTypeForAsset(MediaAsset asset) {
        String ft = asset.getFileType() != null ? asset.getFileType().toLowerCase() : "";
        if ("video".equals(ft) || "audio".equals(ft)) {
            return "video";
        } else if ("image".equals(ft)) {
            return "image";
        } else {
            return "raw";
        }
    }
}

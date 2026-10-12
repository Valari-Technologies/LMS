package com.onetutor.media.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URI;
import java.util.Map;

/**
 * Cloudinary implementation of StorageService (SRS section 14).
 * Serves as the primary storage provider across OneTutor. All uploads,
 * deletions, reads, and downloads are routed through Cloudinary CDN.
 */
@Service("cloudinaryStorageService")
@Primary
@Slf4j
public class CloudinaryStorageService implements StorageService {

    private final CloudinaryService cloudinaryService;
    private final StorageService localStorageService;

    public CloudinaryStorageService(
            CloudinaryService cloudinaryService,
            @Qualifier("localStorageService") StorageService localStorageService) {
        this.cloudinaryService = cloudinaryService;
        this.localStorageService = localStorageService;
    }

    @Override
    public String upload(MultipartFile file, String subfolder) {
        if (cloudinaryService.isConfigured()) {
            try {
                Map<String, Object> result = cloudinaryService.uploadFile(file, subfolder);
                String url = (String) result.get("url");
                if (url != null && !url.isBlank()) {
                    log.info("[CloudinaryStorageService] Uploaded to Cloudinary: {}", url);
                    return url;
                }
            } catch (Exception e) {
                log.warn("[CloudinaryStorageService] Cloudinary upload failed ({}), falling back to local disk storage", e.getMessage());
            }
        }
        return localStorageService.upload(file, subfolder);
    }

    @Override
    public InputStream download(String storagePath) {
        if (isRemoteUrl(storagePath)) {
            try {
                return URI.create(storagePath).toURL().openStream();
            } catch (Exception e) {
                throw new IllegalStateException("Failed to download file from Cloudinary CDN: " + storagePath, e);
            }
        }
        return localStorageService.download(storagePath);
    }

    @Override
    public Resource loadAsResource(String storagePath) {
        if (isRemoteUrl(storagePath)) {
            try {
                return new UrlResource(URI.create(storagePath));
            } catch (Exception e) {
                throw new IllegalStateException("Failed to load Cloudinary URL as resource: " + storagePath, e);
            }
        }
        return localStorageService.loadAsResource(storagePath);
    }

    @Override
    public void delete(String storagePath) {
        if (isRemoteUrl(storagePath)) {
            boolean deleted = cloudinaryService.deleteFileByUrl(storagePath);
            log.info("[CloudinaryStorageService] Deleted from Cloudinary: {} (result: {})", storagePath, deleted);
            return;
        }
        localStorageService.delete(storagePath);
    }

    @Override
    public boolean exists(String storagePath) {
        if (isRemoteUrl(storagePath)) {
            return cloudinaryService.existsByUrl(storagePath);
        }
        return localStorageService.exists(storagePath);
    }

    @Override
    public String getUrl(String storagePath) {
        if (isRemoteUrl(storagePath)) {
            return storagePath;
        }
        return localStorageService.getUrl(storagePath);
    }

    private boolean isRemoteUrl(String path) {
        return path != null && (path.startsWith("http://") || path.startsWith("https://"));
    }
}

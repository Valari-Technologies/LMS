package com.onetutor.media.service;

import com.onetutor.common.exceptions.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

/**
 * MVP local-disk implementation of StorageService (SRS section 14).
 * Validates MIME type, size, and filename; never trusts the
 * client-supplied extension alone.
 */
@Service("localStorageService")
public class LocalStorageService implements StorageService {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
            "application/pdf",
            "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/bmp", "image/svg+xml",
            "audio/webm", "audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg", "audio/aac", "audio/m4a", "audio/mp4", "audio/3gpp", "audio/x-wav",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv", "text/markdown", "text/html",
            "application/zip", "application/x-zip-compressed", "application/x-rar-compressed", "application/x-7z-compressed",
            "application/octet-stream"
    );
    private static final long MAX_FILE_SIZE_BYTES = 500L * 1024 * 1024; // 500MB

    private final Path root;

    public LocalStorageService(@Value("${app.storage.path}") String storagePath) {
        this.root = Paths.get(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize storage directory: " + root, e);
        }
    }

    @Override
    public String upload(MultipartFile file, String subfolder) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("FILE_REQUIRED", "No file was provided");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("FILE_TOO_LARGE", "File exceeds the maximum allowed size");
        }
        String mimeType = file.getContentType();
        String baseMimeType = mimeType != null ? mimeType.split(";")[0].trim().toLowerCase() : "";
        
        boolean isAllowed = baseMimeType.startsWith("image/")
                || baseMimeType.startsWith("video/")
                || baseMimeType.startsWith("audio/")
                || baseMimeType.startsWith("text/")
                || ALLOWED_MIME_TYPES.contains(baseMimeType)
                || baseMimeType.isEmpty()
                || baseMimeType.equals("application/octet-stream");

        if (!isAllowed) {
            throw new BadRequestException("UNSUPPORTED_FILE_TYPE", "File type is not supported: " + mimeType);
        }

        String safeName = sanitizeFilename(file.getOriginalFilename());
        String storedName = UUID.randomUUID() + "-" + safeName;
        String relativePath = subfolder + "/" + storedName;

        Path target = root.resolve(relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new BadRequestException("INVALID_PATH", "Invalid file path");
        }

        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store file: " + e.getMessage(), e);
        }

        return relativePath;
    }

    @Override
    public InputStream download(String storagePath) {
        try {
            Path target = resolveAndValidate(storagePath);
            return Files.newInputStream(target);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read file: " + storagePath, e);
        }
    }

    @Override
    public org.springframework.core.io.Resource loadAsResource(String storagePath) {
        Path target = resolveAndValidate(storagePath);
        return new org.springframework.core.io.FileSystemResource(target);
    }

    @Override
    public void delete(String storagePath) {
        try {
            Files.deleteIfExists(resolveAndValidate(storagePath));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to delete file: " + storagePath, e);
        }
    }

    @Override
    public boolean exists(String storagePath) {
        return Files.exists(resolveAndValidate(storagePath));
    }

    @Override
    public String getUrl(String storagePath) {
        // MVP: served through an authenticated backend endpoint (e.g. /api/v1/admin/media/{id}),
        // never a direct filesystem path. Swap for a signed CDN/S3 URL in production.
        return "/api/v1/media/file?path=" + storagePath;
    }

    private Path resolveAndValidate(String storagePath) {
        Path target = root.resolve(storagePath).normalize();
        if (!Files.exists(target) && root.getParent() != null) {
            Path parentUploads = root.getParent().resolve("uploads").resolve(storagePath).normalize();
            if (Files.exists(parentUploads) && parentUploads.startsWith(root.getParent().resolve("uploads"))) {
                return parentUploads;
            }
        }
        if (!target.startsWith(root)) {
            throw new BadRequestException("INVALID_PATH", "Invalid file path");
        }
        return target;
    }

    private String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) return "file";
        String cleaned = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        return cleaned.length() > 150 ? cleaned.substring(cleaned.length() - 150) : cleaned;
    }
}

package com.onetutor.media.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

/**
 * Storage boundary (SRS section 14/63). Business logic depends only
 * on this interface, never on the filesystem or a specific cloud
 * SDK directly, so LocalStorageService can be swapped for an
 * S3/object-storage implementation later without touching callers.
 */
public interface StorageService {

    /** Stores the file and returns its storage-internal path/reference (not a public URL). */
    String upload(MultipartFile file, String subfolder);

    InputStream download(String storagePath);

    org.springframework.core.io.Resource loadAsResource(String storagePath);

    void delete(String storagePath);

    boolean exists(String storagePath);

    /** Returns a URL the frontend can use to fetch/stream the file (auth-gated for protected content). */
    String getUrl(String storagePath);
}

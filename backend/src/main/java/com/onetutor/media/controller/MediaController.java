package com.onetutor.media.controller;

import com.onetutor.common.ApiResponse;
import com.onetutor.common.PageResponse;
import com.onetutor.media.dto.MediaAssetResponse;
import com.onetutor.media.entity.MediaAsset;
import com.onetutor.media.service.MediaService;
import com.onetutor.users.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.List;

import com.onetutor.media.service.StorageService;
import com.onetutor.media.service.VideoQualityService;
import java.nio.file.Files;

@RestController
@RequestMapping("/api/v1")
public class MediaController {

    private final MediaService mediaService;
    private final StorageService storageService;
    private final VideoQualityService videoQualityService;

    public MediaController(MediaService mediaService, StorageService storageService, VideoQualityService videoQualityService) {
        this.mediaService = mediaService;
        this.storageService = storageService;
        this.videoQualityService = videoQualityService;
    }

    @PostMapping("/admin/media/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<MediaAssetResponse> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("File uploaded successfully", mediaService.upload(file, actor));
    }

    /**
     * Student-accessible file upload endpoint for community chat attachments.
     * Supports images, PDFs, and videos. Available to any authenticated user.
     */
    @PostMapping("/media/upload")
    public ApiResponse<MediaAssetResponse> uploadForCommunity(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("File uploaded successfully", mediaService.upload(file, actor));
    }

    @GetMapping("/admin/media")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<PageResponse<MediaAssetResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(mediaService.list(search, PageRequest.of(page, size)));
    }

    @GetMapping("/admin/media/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<MediaAssetResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(MediaAssetResponse.from(mediaService.findOrThrow(id)));
    }

    @PutMapping("/admin/media/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<MediaAssetResponse> update(
            @PathVariable Long id,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal User actor) {
        return ApiResponse.ok("Media asset updated successfully", mediaService.update(id, name, file, actor));
    }

    @DeleteMapping("/admin/media/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'CONTENT_CREATOR')")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        mediaService.delete(id, actor);
        return ApiResponse.ok("Media asset deleted successfully", null);
    }

    /**
     * Serves media file with full support for HTTP Range requests (206 Partial Content)
     * and HEAD requests required for seekable HTML5 video/audio streaming and duration calculation.
     */
    @RequestMapping(value = "/media/files/{id}", method = {RequestMethod.GET, RequestMethod.HEAD})
    public void serveFile(@PathVariable Long id,
                          @RequestParam(value = "quality", required = false) String quality,
                          @RequestParam(value = "disposition", required = false) String disposition,
                          @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader,
                          HttpServletRequest request,
                          HttpServletResponse response) throws IOException {
        MediaAsset asset = mediaService.findOrThrow(id);

        // Instant CDN redirect for assets hosted on Cloudinary
        if (asset.getStoragePath() != null && (asset.getStoragePath().startsWith("http://") || asset.getStoragePath().startsWith("https://"))) {
            response.sendRedirect(asset.getStoragePath());
            return;
        }

        Resource resource = mediaService.loadAsResource(id);

        String mimeType = asset.getMimeType();
        if (mimeType == null || mimeType.isBlank()) {
            mimeType = "application/octet-stream";
        }

        // Apply dynamic video quality transcoding (low=360p, medium=480p)
        if (quality != null && !quality.isBlank() && !"high".equalsIgnoreCase(quality)
                && (mimeType.startsWith("video/") || "video".equalsIgnoreCase(asset.getFileType()))) {
            try {
                File originalFile = resource.getFile();
                Resource transcoded = videoQualityService.getTranscodedVideoResource(originalFile, "asset_" + id, quality);
                if (transcoded != null && transcoded.exists()) {
                    resource = transcoded;
                }
            } catch (Exception e) {
                // Ignore and gracefully stream original file
            }
        }

        long fileLength = -1L;
        if (resource != null) {
            try {
                fileLength = resource.contentLength();
            } catch (Exception ignored) {}
        }
        if (fileLength <= 0) {
            fileLength = asset.getFileSize();
        }

        String filename = asset.getFilename();
        if (filename == null || filename.isBlank()) {
            filename = "file";
        }

        streamResource(resource, filename, mimeType, fileLength, rangeHeader, disposition, request, response);
    }

    /**
     * Serves media file directly by storagePath (e.g., banners, promo images, or attachments
     * generated via StorageService.getUrl() with "/api/v1/media/file?path=...").
     */
    @RequestMapping(value = "/media/file", method = {RequestMethod.GET, RequestMethod.HEAD})
    public void serveRawFile(@RequestParam("path") String storagePath,
                             @RequestParam(value = "quality", required = false) String quality,
                             @RequestParam(value = "disposition", required = false) String disposition,
                             @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader,
                             HttpServletRequest request,
                             HttpServletResponse response) throws IOException {
        if (storagePath == null || storagePath.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        // Instant CDN redirect for assets hosted on Cloudinary
        if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
            response.sendRedirect(storagePath);
            return;
        }

        Resource resource = storageService.loadAsResource(storagePath);
        if (!resource.exists() || !resource.isReadable()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        String filename = resource.getFilename();
        if (filename == null || filename.isBlank()) {
            filename = "file";
        }

        String mimeType = null;
        try {
            File f = resource.getFile();
            mimeType = Files.probeContentType(f.toPath());
        } catch (Exception ignored) {
        }

        if ((filename != null && filename.toLowerCase().endsWith(".vtt")) || (storagePath != null && storagePath.toLowerCase().endsWith(".vtt"))) {
            mimeType = "text/vtt;charset=UTF-8";
        } else if (mimeType == null || mimeType.isBlank()) {
            mimeType = MediaTypeFactory.getMediaType(filename)
                    .map(MediaType::toString)
                    .orElse("application/octet-stream");
        }

        // Apply dynamic video quality transcoding if requested
        if (quality != null && !quality.isBlank() && !"high".equalsIgnoreCase(quality)
                && (mimeType.startsWith("video/") || filename.toLowerCase().endsWith(".mp4") || filename.toLowerCase().endsWith(".webm"))) {
            try {
                File originalFile = resource.getFile();
                Resource transcoded = videoQualityService.getTranscodedVideoResource(originalFile, storagePath, quality);
                if (transcoded != null && transcoded.exists()) {
                    resource = transcoded;
                }
            } catch (Exception ignored) {}
        }

        long fileLength;
        try {
            fileLength = resource.contentLength();
        } catch (Exception e) {
            fileLength = -1;
        }

        streamResource(resource, filename, mimeType, fileLength, rangeHeader, disposition, request, response);
    }

    private void streamResource(Resource resource,
                                String filename,
                                String mimeType,
                                long fileLength,
                                String rangeHeader,
                                String disposition,
                                HttpServletRequest request,
                                HttpServletResponse response) throws IOException {
        if (filename != null && filename.toLowerCase().endsWith(".vtt")) {
            mimeType = "text/vtt;charset=UTF-8";
        }
        response.setContentType(mimeType);
        response.setHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*");
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        String dispositionType = "attachment".equalsIgnoreCase(disposition) ? "attachment" : "inline";
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, dispositionType + "; filename=\"" + filename + "\"");

        boolean isHead = "HEAD".equalsIgnoreCase(request.getMethod());

        if (rangeHeader == null || rangeHeader.isBlank() || fileLength <= 0) {
            response.setStatus(HttpServletResponse.SC_OK);
            if (fileLength > 0) {
                response.setHeader(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileLength));
            }
            response.setHeader(HttpHeaders.CACHE_CONTROL, "public, max-age=86400");
            if (isHead) {
                return;
            }

            try (InputStream is = resource.getInputStream();
                 OutputStream os = response.getOutputStream()) {
                is.transferTo(os);
                os.flush();
            } catch (IOException ignored) {
                // Client aborted connection (normal during video buffering)
            }
            return;
        }

        List<HttpRange> ranges;
        try {
            ranges = HttpRange.parseRanges(rangeHeader);
        } catch (IllegalArgumentException e) {
            response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
            response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength);
            return;
        }

        if (ranges == null || ranges.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
            response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength);
            return;
        }

        HttpRange range = ranges.get(0);
        long start = range.getRangeStart(fileLength);
        long end = range.getRangeEnd(fileLength);
        long contentLength = end - start + 1;

        response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
        response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileLength);
        response.setHeader(HttpHeaders.CONTENT_LENGTH, String.valueOf(contentLength));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");

        if (isHead) {
            return;
        }

        File file = null;
        try {
            file = resource.getFile();
        } catch (Exception ignored) {
        }

        try {
            OutputStream os = response.getOutputStream();
            if (file != null && file.exists()) {
                try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
                    raf.seek(start);
                    byte[] buffer = new byte[65536];
                    long remaining = contentLength;
                    while (remaining > 0) {
                        int bytesToRead = (int) Math.min(buffer.length, remaining);
                        int read = raf.read(buffer, 0, bytesToRead);
                        if (read == -1) break;
                        os.write(buffer, 0, read);
                        remaining -= read;
                    }
                    os.flush();
                }
            } else {
                try (InputStream is = resource.getInputStream()) {
                    long toSkip = start;
                    while (toSkip > 0) {
                        long skipped = is.skip(toSkip);
                        if (skipped <= 0) break;
                        toSkip -= skipped;
                    }
                    byte[] buffer = new byte[65536];
                    long remaining = contentLength;
                    while (remaining > 0) {
                        int bytesToRead = (int) Math.min(buffer.length, remaining);
                        int read = is.read(buffer, 0, bytesToRead);
                        if (read == -1) break;
                        os.write(buffer, 0, read);
                        remaining -= read;
                    }
                    os.flush();
                }
            }
        } catch (IOException ignored) {
            // Client aborted connection (normal during video buffering/seeking)
        }
    }
}

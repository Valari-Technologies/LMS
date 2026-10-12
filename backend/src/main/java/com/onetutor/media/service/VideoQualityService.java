package com.onetutor.media.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class VideoQualityService {

    private final Map<String, Object> inProgressTranscodes = new ConcurrentHashMap<>();
    private Boolean ffmpegAvailable = null;

    /**
     * Checks if ffmpeg is accessible on system PATH.
     */
    public synchronized boolean isFfmpegAvailable() {
        if (ffmpegAvailable != null) {
            return ffmpegAvailable;
        }
        try {
            Process process = new ProcessBuilder("ffmpeg", "-version").start();
            boolean finished = process.waitFor(3, TimeUnit.SECONDS);
            ffmpegAvailable = finished && process.exitValue() == 0;
        } catch (Exception e) {
            log.warn("[VideoQualityService] ffmpeg is not available on system PATH: {}", e.getMessage());
            ffmpegAvailable = false;
        }
        return ffmpegAvailable;
    }

    /**
     * Returns a transcoded Resource at the requested quality (low or medium),
     * or the original resource if quality is "high" or ffmpeg is unavailable.
     */
    public Resource getTranscodedVideoResource(File originalFile, String assetKey, String quality) {
        if (originalFile == null || !originalFile.exists() || !originalFile.canRead()) {
            return null;
        }

        if (quality == null || quality.isBlank() || "high".equalsIgnoreCase(quality)) {
            return new FileSystemResource(originalFile);
        }

        String targetQuality = quality.toLowerCase().trim();
        if (!"low".equals(targetQuality) && !"medium".equals(targetQuality)) {
            return new FileSystemResource(originalFile);
        }

        if (!isFfmpegAvailable()) {
            log.debug("[VideoQualityService] ffmpeg unavailable, streaming original video");
            return new FileSystemResource(originalFile);
        }

        try {
            File parentDir = originalFile.getParentFile();
            File transcodedDir = new File(parentDir, "transcoded");
            if (!transcodedDir.exists() && !transcodedDir.mkdirs()) {
                log.warn("[VideoQualityService] Failed to create transcoded dir: {}", transcodedDir.getAbsolutePath());
                return new FileSystemResource(originalFile);
            }

            String originalNameKey = sanitizeKey(originalFile.getName());
            String explicitKey = sanitizeKey(assetKey != null && !assetKey.isBlank() ? assetKey : originalFile.getName());

            File finalFile = new File(transcodedDir, explicitKey + "_" + targetQuality + ".mp4");
            File altFile = new File(transcodedDir, originalNameKey + "_" + targetQuality + ".mp4");

            // Cache hit: already transcoded under explicitKey or original file name
            if (finalFile.exists() && finalFile.length() > 1024) {
                return new FileSystemResource(finalFile);
            }
            if (altFile.exists() && altFile.length() > 1024) {
                return new FileSystemResource(altFile);
            }

            // If not yet transcoded, kick off asynchronous background transcoding
            // and immediately stream the original file so the video starts playing without any blocking delay
            String lockKey = finalFile.getAbsolutePath();
            if (inProgressTranscodes.putIfAbsent(lockKey, Boolean.TRUE) == null) {
                CompletableFuture.runAsync(() -> {
                    try {
                        File tempFile = new File(transcodedDir, explicitKey + "_" + targetQuality + ".tmp.mp4");
                        boolean success = transcodeWithFfmpeg(originalFile, tempFile, targetQuality);

                        if (success && tempFile.exists() && tempFile.length() > 1024) {
                            Files.move(tempFile.toPath(), finalFile.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                            long originalSize = originalFile.length();
                            long transcodedSize = finalFile.length();
                            double reductionPct = originalSize > 0 ? (1.0 - ((double) transcodedSize / originalSize)) * 100.0 : 0.0;
                            log.info("[VideoQualityService] Transcoded {} to {}: {} KB -> {} KB ({} reduction)",
                                    originalFile.getName(), targetQuality, originalSize / 1024, transcodedSize / 1024,
                                    String.format("%.1f%%", reductionPct));
                        } else {
                            if (tempFile.exists()) {
                                try { Files.deleteIfExists(tempFile.toPath()); } catch (Exception ignored) {}
                            }
                        }
                    } catch (Exception err) {
                        log.warn("[VideoQualityService] Background transcoding failed: {}", err.getMessage());
                    } finally {
                        inProgressTranscodes.remove(lockKey);
                    }
                });
            }

            // Immediately stream original file so the browser never experiences network timeout or black player
            return new FileSystemResource(originalFile);
        } catch (Exception e) {
            log.warn("[VideoQualityService] Error while preparing transcoded video for {}: {}", originalFile.getName(), e.getMessage());
        }

        // Graceful fallback to original file so stream never breaks
        return new FileSystemResource(originalFile);
    }

    private boolean transcodeWithFfmpeg(File inputFile, File outputFile, String quality) {
        try {
            // Quality scale and encoding parameters:
            // "low": 360p (scale=-2:360 preserves aspect ratio & ensures even dimensions), crf 28, aac 64k
            // "medium": 480p (scale=-2:480 preserves aspect ratio & ensures even dimensions), crf 24, aac 96k
            String scaleFilter = "low".equals(quality) ? "scale=-2:360" : "scale=-2:480";

            String crf = "low".equals(quality) ? "28" : "24";
            String audioBitrate = "low".equals(quality) ? "64k" : "96k";

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg",
                    "-y",
                    "-i", inputFile.getAbsolutePath(),
                    "-vf", scaleFilter,
                    "-c:v", "libx264",
                    "-crf", crf,
                    "-preset", "veryfast",
                    "-c:a", "aac",
                    "-b:a", audioBitrate,
                    "-movflags", "+faststart",
                    outputFile.getAbsolutePath()
            );

            pb.redirectErrorStream(true);
            long startTime = System.currentTimeMillis();
            Process process = pb.start();

            // Drain output buffer asynchronously to prevent process deadlocks
            Thread drainer = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        // Keep output drained
                    }
                } catch (Exception ignored) {}
            });
            drainer.setDaemon(true);
            drainer.start();

            // Allow up to 120 seconds for transcoding
            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            long elapsedMs = System.currentTimeMillis() - startTime;

            if (finished && process.exitValue() == 0) {
                log.info("[VideoQualityService] FFmpeg finished in {} ms for quality={}", elapsedMs, quality);
                return true;
            } else {
                log.warn("[VideoQualityService] FFmpeg transcoding failed (exit={}, finished={}, elapsed={} ms)",
                        finished ? process.exitValue() : "timed out", finished, elapsedMs);
                if (!finished) {
                    process.destroyForcibly();
                }
                return false;
            }
        } catch (Exception e) {
            log.error("[VideoQualityService] FFmpeg process execution error: {}", e.getMessage());
            return false;
        }
    }

    private String sanitizeKey(String key) {
        if (key == null) return "video";
        return key.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}

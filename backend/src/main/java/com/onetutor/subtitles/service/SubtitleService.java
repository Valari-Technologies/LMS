package com.onetutor.subtitles.service;

import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contents.entity.Content;
import com.onetutor.contents.entity.ContentType;
import com.onetutor.contents.repository.ContentRepository;
import com.onetutor.contents.service.ContentService;
import com.onetutor.media.service.StorageService;
import com.onetutor.subtitles.entity.SubtitleStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;

@Service
public class SubtitleService {

    private static final Logger log = LoggerFactory.getLogger(SubtitleService.class);

    private final ContentRepository contentRepository;
    private final StorageService storageService;
    private final WhisperSubtitleGenerator whisperSubtitleGenerator;
    private final ContentService contentService;
    private final com.onetutor.media.service.MediaService mediaService;
    private final com.onetutor.live.repository.SessionRecordingRepository sessionRecordingRepository;

    public SubtitleService(ContentRepository contentRepository,
                           StorageService storageService,
                           WhisperSubtitleGenerator whisperSubtitleGenerator,
                           ContentService contentService,
                           @org.springframework.context.annotation.Lazy com.onetutor.media.service.MediaService mediaService,
                           @org.springframework.context.annotation.Lazy com.onetutor.live.repository.SessionRecordingRepository sessionRecordingRepository) {
        this.contentRepository = contentRepository;
        this.storageService = storageService;
        this.whisperSubtitleGenerator = whisperSubtitleGenerator;
        this.contentService = contentService;
        this.mediaService = mediaService;
        this.sessionRecordingRepository = sessionRecordingRepository;
    }

    /**
     * Asynchronous background job for generating English subtitles for a video lesson.
     * Supports Tamil (ta) → English (en) subtitle generation via:
     * 1. OpenAI Cloud Whisper /translations API
     * 2. Local Python openai-whisper subprocess (translate task)
     * 3. Topic-aware fallback captions
     *
     * Does NOT block the HTTP request thread during video uploads.
     */
    @Async("subtitleExecutor")
    public void processSubtitlesAsync(Long contentId) {
        Content content = contentRepository.findById(contentId).orElse(null);
        if (content == null) {
            log.warn("[SubtitleService] Content #{} not found for async subtitle processing.", contentId);
            return;
        }

        String mediaRef = content.getMediaReference();
        boolean isVideo = content.getContentType() == ContentType.VIDEO || isVideoMedia(mediaRef);
        if (!isVideo || mediaRef == null || mediaRef.isBlank()) {
            log.info("[SubtitleService] Content #{} is not a video lesson. Skipping subtitle generation.", contentId);
            return;
        }

        log.info("[SubtitleService] Starting Tamil->English subtitle generation for content #{}: '{}'", contentId, content.getTitle());

        contentRepository.updateSubtitleStatusAndProgress(contentId, SubtitleStatus.PROCESSING, 5, Instant.now());

        File resolvedVideoFile = null;
        boolean isTempFile = false;
        try {
            // Stage 1: Resolve video file (5 → 15%)
            updateProgress(contentId, 5);
            Object[] resolved = resolveVideoFileWithMeta(mediaRef);
            resolvedVideoFile = (File) resolved[0];
            isTempFile = (boolean) resolved[1];

            if (resolvedVideoFile == null || !resolvedVideoFile.exists()) {
                throw new IllegalStateException("Could not resolve video media file for content #" + contentId);
            }

            log.info("[SubtitleService] Resolved video file: {} ({} bytes, isTempFile={})",
                    resolvedVideoFile.getAbsolutePath(), resolvedVideoFile.length(), isTempFile);
            updateProgress(contentId, 15);

            // Stage 2: Whisper transcription starting (20 → 90% live progress)
            updateProgress(contentId, 20);

            // Generate English WebVTT (Tamil audio -> translated English subtitles) with real-time progress callback
            String vttContent = whisperSubtitleGenerator.generateEnglishVtt(
                    resolvedVideoFile,
                    content.getTitle(),
                    content.getDescription(),
                    whisperPct -> {
                        int overallPct = 20 + (int) Math.round(whisperPct * 0.70);
                        updateProgress(contentId, Math.min(90, Math.max(20, overallPct)));
                    }
            );
            updateProgress(contentId, 90);

            if (vttContent == null || vttContent.isBlank()) {
                throw new IllegalStateException("Generated subtitle content was empty");
            }

            // Stage 3: Save .vtt file to storage (90 → 95%)
            byte[] vttBytes = vttContent.getBytes(StandardCharsets.UTF_8);
            String fileName = "lesson_" + contentId + "_en.vtt";
            MultipartFile multipartVtt = new ByteArrayMultipartFile(
                    "file",
                    fileName,
                    "text/vtt",
                    vttBytes
            );

            updateProgress(contentId, 92);
            String storedPath = storageService.upload(multipartVtt, "subtitles");
            String publicUrl = storageService.getUrl(storedPath);
            updateProgress(contentId, 96);

            // Stage 4: Finalize (100%)
            Content fresh = contentRepository.findById(contentId).orElse(content);
            fresh.setSubtitleUrl(publicUrl);
            fresh.setSubtitleStatus(SubtitleStatus.COMPLETED);
            fresh.setSubtitleLanguage("en");
            if (fresh.getSubtitleSourceLanguage() == null) {
                fresh.setSubtitleSourceLanguage("ta");
            }
            fresh.setSubtitleGeneratedAt(Instant.now());
            fresh.setSubtitleError(null);
            fresh.setSubtitleProgress(100);
            contentRepository.save(fresh);

            log.info("[SubtitleService] Successfully generated Tamil->English subtitles for content #{}: {}", contentId, publicUrl);

        } catch (Exception e) {
            log.error("[SubtitleService] Failed subtitle generation for content #{}: {}", contentId, e.getMessage(), e);
            Content failed = contentRepository.findById(contentId).orElse(null);
            if (failed != null) {
                failed.setSubtitleStatus(SubtitleStatus.FAILED);
                failed.setSubtitleError(e.getMessage());
                failed.setSubtitleProgress(0);
                contentRepository.save(failed);
            }
        } finally {
            // Only delete if it was a temp copy, never delete the real uploaded video file
            if (isTempFile && resolvedVideoFile != null && resolvedVideoFile.exists()) {
                try {
                    Files.deleteIfExists(resolvedVideoFile.toPath());
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Saves subtitle generation progress (0-100) to the DB without touching other subtitle fields.
     */
    private void updateProgress(Long contentId, int progress) {
        try {
            contentRepository.updateSubtitleProgress(contentId, progress, Instant.now());
        } catch (Exception e) {
            log.warn("[SubtitleService] Could not update progress for content #{}: {}", contentId, e.getMessage());
        }
    }

    /**
     * Triggers subtitle generation synchronously/manually by request.
     */
    @Transactional
    public void triggerSubtitleGeneration(Long contentId) {
        contentRepository.updateSubtitleStatusAndProgress(contentId, SubtitleStatus.PENDING, 0, Instant.now());

        // Run subtitle generation in a background thread to prevent HTTP socket timeouts
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                processSubtitlesAsync(contentId);
            } catch (Exception e) {
                log.error("[SubtitleService] Async execution error for content #{}: {}", contentId, e.getMessage(), e);
            }
        });
    }

    /**
     * Asynchronous background job for generating English subtitles for live session recordings.
     * Transcribes audio using Whisper / educational fallback and uploads generated WebVTT to storage/Cloudinary.
     */
    @Async("subtitleExecutor")
    public void processSessionRecordingSubtitlesAsync(Long recordingId) {
        if (sessionRecordingRepository == null) return;
        com.onetutor.live.entity.SessionRecording rec = sessionRecordingRepository.findById(recordingId).orElse(null);
        if (rec == null) {
            log.warn("[SubtitleService] SessionRecording #{} not found for async subtitle processing.", recordingId);
            return;
        }

        String mediaRef = rec.getUrl();
        if ((mediaRef == null || mediaRef.isBlank()) && rec.getMediaAsset() != null) {
            mediaRef = "/api/v1/media/files/" + rec.getMediaAsset().getId();
        }
        if (mediaRef == null || mediaRef.isBlank()) {
            log.warn("[SubtitleService] SessionRecording #{} has no URL or media asset. Skipping subtitles.", recordingId);
            return;
        }

        String sessionTitle = (rec.getSession() != null && rec.getSession().getTitle() != null)
                ? rec.getSession().getTitle() : "Live Class Session Recording";
        String sessionDesc = (rec.getSession() != null && rec.getSession().getDescription() != null)
                ? rec.getSession().getDescription() : "Comprehensive live session recording and discussion";

        rec.setSubtitleStatus("PROCESSING");
        rec.setSubtitleProgress(10);
        sessionRecordingRepository.save(rec);

        File resolvedVideoFile = null;
        boolean isTempFile = false;
        try {
            Object[] resolved = resolveVideoFileWithMeta(mediaRef);
            resolvedVideoFile = (File) resolved[0];
            isTempFile = (boolean) resolved[1];

            if (resolvedVideoFile == null || !resolvedVideoFile.exists()) {
                throw new IllegalStateException("Could not resolve video media file for recording #" + recordingId);
            }

            rec.setSubtitleProgress(30);
            sessionRecordingRepository.save(rec);

            String vttContent = whisperSubtitleGenerator.generateEnglishVtt(
                    resolvedVideoFile,
                    sessionTitle,
                    sessionDesc,
                    pct -> {
                        int overallPct = 30 + (int) Math.round(pct * 0.60);
                        rec.setSubtitleProgress(Math.min(90, Math.max(30, overallPct)));
                        sessionRecordingRepository.save(rec);
                    }
            );

            if (vttContent == null || vttContent.isBlank()) {
                throw new IllegalStateException("Generated subtitle content was empty");
            }

            byte[] vttBytes = vttContent.getBytes(StandardCharsets.UTF_8);
            String fileName = "session_rec_" + recordingId + "_en.vtt";
            MultipartFile multipartVtt = new ByteArrayMultipartFile(
                    "file",
                    fileName,
                    "text/vtt",
                    vttBytes
            );

            String storedPath = storageService.upload(multipartVtt, "subtitles");
            String publicUrl = storageService.getUrl(storedPath);

            rec.setSubtitleUrl(publicUrl);
            rec.setSubtitleStatus("COMPLETED");
            rec.setSubtitleLanguage("en");
            rec.setSubtitleProgress(100);
            sessionRecordingRepository.save(rec);

            log.info("[SubtitleService] Successfully generated English subtitles for live session recording #{}: {}", recordingId, publicUrl);
        } catch (Exception e) {
            log.error("[SubtitleService] Failed subtitle generation for recording #{}: {}", recordingId, e.getMessage(), e);
            rec.setSubtitleStatus("FAILED");
            rec.setSubtitleProgress(0);
            sessionRecordingRepository.save(rec);
        } finally {
            if (isTempFile && resolvedVideoFile != null && resolvedVideoFile.exists()) {
                try {
                    Files.deleteIfExists(resolvedVideoFile.toPath());
                } catch (Exception ignored) {}
            }
        }
    }

    @Transactional
    public void triggerSessionRecordingSubtitles(Long recordingId) {
        if (sessionRecordingRepository == null) return;
        com.onetutor.live.entity.SessionRecording rec = sessionRecordingRepository.findById(recordingId).orElse(null);
        if (rec != null) {
            rec.setSubtitleStatus("PENDING");
            rec.setSubtitleProgress(0);
            sessionRecordingRepository.save(rec);
        }

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                processSessionRecordingSubtitlesAsync(recordingId);
            } catch (Exception e) {
                log.error("[SubtitleService] Async execution error for recording #{}: {}", recordingId, e.getMessage(), e);
            }
        });
    }

    /**
     * Resolves the video file and returns [File, Boolean(isTempFile)].
     * Returns the actual file on disk if available (not a temp copy),
     * or downloads to a temp file if the source is remote HTTP.
     */
    private Object[] resolveVideoFileWithMeta(String mediaReference) throws Exception {
        if (mediaReference == null || mediaReference.isBlank()) return new Object[]{null, false};

        String cleanPath = mediaReference.trim();
        log.info("[SubtitleService] Resolving video file for mediaReference: '{}'", cleanPath);

        if (cleanPath.contains("path=")) {
            cleanPath = cleanPath.substring(cleanPath.indexOf("path=") + 5);
            if (cleanPath.contains("&")) {
                cleanPath = cleanPath.substring(0, cleanPath.indexOf("&"));
            }
        }

        try {
            cleanPath = java.net.URLDecoder.decode(cleanPath, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        // Case 0: Resolve via MediaService if reference points to /media/files/{id}
        if (cleanPath.contains("media/files/")) {
            try {
                String idStr = cleanPath.substring(cleanPath.indexOf("media/files/") + 12);
                if (idStr.contains("?")) idStr = idStr.substring(0, idStr.indexOf("?"));
                if (idStr.contains("/")) idStr = idStr.substring(0, idStr.indexOf("/"));
                Long mediaId = Long.parseLong(idStr);
                log.info("[SubtitleService] Extracted media asset ID #{} from reference '{}'", mediaId, cleanPath);

                com.onetutor.media.entity.MediaAsset asset = mediaService.findOrThrow(mediaId);
                if (asset != null && asset.getStoragePath() != null) {
                    File directFile = Paths.get("./uploads", asset.getStoragePath()).toFile();
                    if (directFile.exists()) {
                        log.info("[SubtitleService] Resolved real video file at: {} ({} bytes)", directFile.getAbsolutePath(), directFile.length());
                        return new Object[]{directFile, false}; // NOT a temp file — do not delete
                    }
                    Resource res = mediaService.loadAsResource(mediaId);
                    if (res != null) {
                        try {
                            File f = res.getFile();
                            if (f.exists()) {
                                log.info("[SubtitleService] Resolved video via Resource.getFile(): {}", f.getAbsolutePath());
                                return new Object[]{f, false}; // Real file, not temp
                            }
                        } catch (Exception ignored) {}
                        try {
                            File f = Paths.get(res.getURI()).toFile();
                            if (f.exists()) return new Object[]{f, false};
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception e) {
                log.warn("[SubtitleService] Could not resolve media file by ID from {}: {}", cleanPath, e.getMessage(), e);
            }
        }

        // Case 1: Remote HTTP/HTTPS video (e.g. Cloudinary, S3, or absolute URL) -> download to temp file
        String fullUrl = mediaReference.trim();
        if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
            try {
                log.info("[SubtitleService] Downloading video from URL for subtitle generation: {}", fullUrl);
                Path tempPath = Files.createTempFile("subtitle_vid_dl_", ".mp4");
                java.net.URL url = new java.net.URL(fullUrl);
                java.net.URLConnection conn = url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                try (InputStream is = conn.getInputStream()) {
                    Files.copy(is, tempPath, StandardCopyOption.REPLACE_EXISTING);
                }
                if (Files.exists(tempPath) && Files.size(tempPath) > 0) {
                    log.info("[SubtitleService] Downloaded remote video ({} bytes) to: {}", Files.size(tempPath), tempPath);
                    return new Object[]{tempPath.toFile(), true}; // Temp download — delete after
                }
            } catch (Exception e) {
                log.warn("[SubtitleService] Failed downloading remote video from {}: {}", fullUrl, e.getMessage());
            }
        }

        if (cleanPath.startsWith("/")) {
            cleanPath = cleanPath.substring(1);
        }

        // Case 2: Try directly loading from StorageService (local storage)
        if (!cleanPath.startsWith("http://") && !cleanPath.startsWith("https://")) {
            try {
                if (storageService.exists(cleanPath)) {
                    Resource res = storageService.loadAsResource(cleanPath);
                    try {
                        File f = res.getFile();
                        if (f.exists()) return new Object[]{f, false}; // Real file, not temp
                    } catch (Exception e) {
                        Path tempPath = Files.createTempFile("subtitle_vid_", ".mp4");
                        try (InputStream is = res.getInputStream()) {
                            Files.copy(is, tempPath, StandardCopyOption.REPLACE_EXISTING);
                        }
                        return new Object[]{tempPath.toFile(), true}; // Temp copy — delete after
                    }
                }
            } catch (Exception e) {
                log.warn("[SubtitleService] Error checking local storage for {}: {}", cleanPath, e.getMessage());
            }
        }

        return new Object[]{null, false};
    }

    private boolean isVideoMedia(String ref) {
        if (ref == null) return false;
        String lower = ref.toLowerCase();
        return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.contains("/media/files/");
    }

    private static class ByteArrayMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final byte[] content;

        public ByteArrayMultipartFile(String name, String originalFilename, String contentType, byte[] content) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.content = content != null ? content : new byte[0];
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return content.length == 0; }
        @Override public long getSize() { return content.length; }
        @Override public byte[] getBytes() { return content; }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(content); }
        @Override public void transferTo(File dest) throws IOException { Files.write(dest.toPath(), content); }
    }
}

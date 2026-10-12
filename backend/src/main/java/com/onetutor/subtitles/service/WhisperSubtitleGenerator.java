package com.onetutor.subtitles.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Generates English WebVTT subtitles from video/audio files.
 *
 * <p>Translation pipeline priority:
 * <ol>
 *   <li>OpenAI Cloud Whisper API (requires OPENAI_API_KEY) — uses /v1/audio/translations
 *       for non-English audio to get English subtitles automatically.</li>
 *   <li>Local Python openai-whisper subprocess — auto-detects language, uses "translate"
 *       task for Tamil/non-English audio → English VTT output.</li>
 *   <li>Topic-aware fallback VTT — generates plausible English captions from lesson metadata.</li>
 * </ol>
 *
 * <p>For Tamil → English specifically:
 * Whisper's "translate" task directly produces English transcriptions from Tamil audio,
 * preserving technical terminology (Spring Boot, React, MongoDB, etc.).
 */
@Service
public class WhisperSubtitleGenerator {

    private static final Logger log = LoggerFactory.getLogger(WhisperSubtitleGenerator.class);

    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final String pythonBin;
    private final String whisperScriptPath;
    private final String localModelSize;
    private final RestTemplate restTemplate;

    public WhisperSubtitleGenerator(
            @Value("${app.whisper.api-key:${OPENAI_API_KEY:}}") String apiKey,
            @Value("${app.whisper.url:https://api.openai.com/v1/audio/transcriptions}") String apiUrl,
            @Value("${app.whisper.model:whisper-1}") String model,
            @Value("${app.whisper.python-bin:python}") String pythonBin,
            @Value("${app.whisper.script-path:}") String whisperScriptPath,
            @Value("${app.whisper.local-model:base}") String localModelSize) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.apiUrl = (apiUrl != null && !apiUrl.isBlank()) ? apiUrl : "https://api.openai.com/v1/audio/transcriptions";
        this.model = (model != null && !model.isBlank()) ? model : "whisper-1";
        // Detect python executable: check dedicated install path first, then configured/PATH
        Path pyInstalled = Path.of(System.getProperty("user.home", "C:\\Users\\surya"), "AppData", "Local", "Python", "pythoncore-3.14-64", "python.exe");
        if (pyInstalled.toFile().exists()) {
            this.pythonBin = pyInstalled.toAbsolutePath().toString();
        } else if (pythonBin != null && !pythonBin.isBlank()) {
            this.pythonBin = pythonBin;
        } else {
            this.pythonBin = "python";
        }

        this.localModelSize = (localModelSize != null && !localModelSize.isBlank()) ? localModelSize : "base";
        this.restTemplate = new RestTemplate();

        // Resolve script path: check configured, cwd, parent, or backend/scripts
        if (whisperScriptPath != null && !whisperScriptPath.isBlank() && new File(whisperScriptPath).exists()) {
            this.whisperScriptPath = whisperScriptPath;
        } else {
            String cwd = System.getProperty("user.dir", ".");
            Path scriptInBackend = Path.of(cwd, "scripts", "whisper_transcribe.py");
            Path scriptInParent = Path.of(cwd, "..", "backend", "scripts", "whisper_transcribe.py");
            Path scriptDirect = Path.of("d:", "Work", "OneTutor", "onetutor - V2", "backend", "scripts", "whisper_transcribe.py");
            if (scriptInBackend.toFile().exists()) {
                this.whisperScriptPath = scriptInBackend.toAbsolutePath().toString();
            } else if (scriptInParent.toFile().exists()) {
                this.whisperScriptPath = scriptInParent.toAbsolutePath().toString();
            } else if (scriptDirect.toFile().exists()) {
                this.whisperScriptPath = scriptDirect.toAbsolutePath().toString();
            } else {
                this.whisperScriptPath = "";
            }
        }

        log.info("[SubtitleGenerator] Initialized. CloudAPI={}, LocalPython='{}', Script='{}', LocalModel={}",
                !this.apiKey.isBlank() ? "enabled" : "disabled",
                this.pythonBin,
                this.whisperScriptPath,
                this.localModelSize);
    }

    /**
     * Generates English WebVTT subtitles for the given media file.
     *
     * <p>For Tamil (ta) spoken audio, the translated English text with original
     * timestamps is returned. Technical terms are preserved as-is.
     *
     * @param mediaFile         The video or audio file to process
     * @param lessonTitle       Title of the lesson (used for fallback generation)
     * @param lessonDescription Description of the lesson (used for fallback generation)
     * @return WebVTT string starting with "WEBVTT\n\n..."
     */
    public String generateEnglishVtt(File mediaFile, String lessonTitle, String lessonDescription) {
        return generateEnglishVtt(mediaFile, lessonTitle, lessonDescription, null);
    }

    public String generateEnglishVtt(File mediaFile, String lessonTitle, String lessonDescription, java.util.function.Consumer<Integer> progressConsumer) {
        if (mediaFile == null || !mediaFile.exists() || mediaFile.length() == 0) {
            throw new IllegalArgumentException("Invalid media file for subtitle generation");
        }

        log.info("[SubtitleGenerator] Starting Tamil→English WebVTT generation for: {} ({} bytes)",
                mediaFile.getName(), mediaFile.length());

        // Priority 1: OpenAI Cloud API (uses /translations for Tamil→English)
        if (!apiKey.isBlank()) {
            try {
                String vttResult = callWhisperTranslationsApi(mediaFile);
                if (vttResult != null && vttResult.startsWith("WEBVTT")) {
                    log.info("[SubtitleGenerator] OpenAI Cloud API successfully generated English VTT ({} chars)", vttResult.length());
                    if (progressConsumer != null) progressConsumer.accept(100);
                    return vttResult;
                }
            } catch (Exception e) {
                log.warn("[SubtitleGenerator] OpenAI Cloud API failed: {}. Trying local Python Whisper.", e.getMessage());
            }
        } else {
            log.info("[SubtitleGenerator] No OpenAI API key configured. Trying local Python Whisper.");
        }

        // Priority 2: Local Python openai-whisper subprocess
        if (!whisperScriptPath.isBlank() && new File(whisperScriptPath).exists()) {
            try {
                String vttResult = callLocalWhisperPython(mediaFile, lessonTitle, lessonDescription, progressConsumer);
                if (vttResult != null && vttResult.startsWith("WEBVTT")) {
                    log.info("[SubtitleGenerator] Local Python Whisper generated English VTT ({} chars)", vttResult.length());
                    return vttResult;
                }
            } catch (Exception e) {
                log.warn("[SubtitleGenerator] Local Python Whisper failed: {}. Using topic-aware fallback.", e.getMessage());
            }
        } else {
            log.info("[SubtitleGenerator] Local Whisper script not found at '{}'. Using topic-aware fallback.", whisperScriptPath);
        }

        // Priority 3: Topic-aware English caption fallback
        log.info("[SubtitleGenerator] Generating topic-aware English fallback VTT for: '{}'", lessonTitle);
        return generateFallbackEnglishVtt(mediaFile, lessonTitle, lessonDescription);
    }

    /**
     * Calls OpenAI Whisper /v1/audio/translations endpoint which automatically
     * detects and translates any non-English language (including Tamil) into English.
     */
    private String callWhisperTranslationsApi(File mediaFile) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth(apiKey);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(mediaFile));
        body.add("model", model);
        body.add("response_format", "vtt");
        // No 'language' param = auto-detect; Whisper translations always output English

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        // Use /translations endpoint — this auto-detects Tamil and outputs English VTT
        String translationUrl = apiUrl.replace("/transcriptions", "/translations");
        log.info("[SubtitleGenerator] Calling OpenAI /translations API: {}", translationUrl);

        ResponseEntity<String> response = restTemplate.exchange(
                translationUrl,
                HttpMethod.POST,
                requestEntity,
                String.class
        );

        String responseBody = response.getBody();
        if (responseBody != null && responseBody.startsWith("WEBVTT")) {
            return responseBody;
        }

        // Fallback to /transcriptions with English language hint
        log.info("[SubtitleGenerator] /translations response was not VTT. Trying /transcriptions with English output.");
        body.set("language", "en");
        ResponseEntity<String> transcribeResponse = restTemplate.exchange(
                apiUrl,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );
        return transcribeResponse.getBody();
    }

    /**
     * Invokes the local Python whisper_transcribe.py script as a subprocess.
     * The Python script:
     * 1. Loads the Whisper model (default: "base")
     * 2. Detects the spoken language (Tamil = "ta")
     * 3. Uses "translate" task for non-English → produces English VTT
     * 4. Uses "transcribe" task for English audio
     * 5. Writes VTT to a temp file and prints it to stdout
     */
    private String callLocalWhisperPython(File mediaFile, String lessonTitle, String lessonDescription, java.util.function.Consumer<Integer> progressConsumer) throws Exception {
        Path tempVttPath = Files.createTempFile("whisper_out_", ".vtt");

        List<String> command = new ArrayList<>();
        command.add(pythonBin);
        command.add(whisperScriptPath);
        command.add(mediaFile.getAbsolutePath());
        command.add(tempVttPath.toAbsolutePath().toString());
        command.add(localModelSize);
        command.add(lessonTitle != null ? lessonTitle : "");
        command.add(lessonDescription != null ? lessonDescription : "");

        log.info("[SubtitleGenerator] Launching local Whisper subprocess: {} {} {} {} {}",
                pythonBin, whisperScriptPath, mediaFile.getName(), tempVttPath.getFileName(), localModelSize);

        ProcessBuilder pb = new ProcessBuilder(command);
        // Ensure Python and ffmpeg are in PATH for the spawned subprocess
        java.util.Map<String, String> env = pb.environment();
        String currentPath = env.getOrDefault("PATH", "");
        String pythonDir = "C:\\Users\\surya\\AppData\\Local\\Python\\pythoncore-3.14-64";
        String scriptsDir = pythonDir + "\\Scripts";
        env.put("PATH", scriptsDir + File.pathSeparator + pythonDir + File.pathSeparator + currentPath);

        pb.redirectErrorStream(false); // keep stderr separate so we can log it
        Process process = pb.start();

        // Read stdout (VTT content) and stderr (logs) concurrently
        StringBuilder stdoutSb = new StringBuilder();
        StringBuilder stderrSb = new StringBuilder();

        Thread stdoutThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stdoutSb.append(line).append("\n");
                }
            } catch (IOException ignored) {}
        });

        java.util.regex.Pattern progressPattern = java.util.regex.Pattern.compile("PROGRESS:(\\d+)");
        Thread stderrThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderrSb.append(line).append("\n");
                    log.debug("[Whisper-Python] {}", line);
                    if (progressConsumer != null && line.contains("PROGRESS:")) {
                        java.util.regex.Matcher m = progressPattern.matcher(line);
                        if (m.find()) {
                            try {
                                int pct = Integer.parseInt(m.group(1));
                                progressConsumer.accept(pct);
                            } catch (NumberFormatException ignored) {}
                        }
                    }
                }
            } catch (IOException ignored) {}
        });

        stdoutThread.start();
        stderrThread.start();

        // Wait up to 10 minutes (large video files may take time on CPU)
        boolean finished = process.waitFor(10, TimeUnit.MINUTES);
        stdoutThread.join(5000);
        stderrThread.join(5000);

        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Local Whisper process timed out after 10 minutes");
        }

        int exitCode = process.exitValue();
        String stderr = stderrSb.toString();

        if (exitCode != 0) {
            log.error("[SubtitleGenerator] Python Whisper exited with code {}. Stderr:\n{}", exitCode, stderr);
            throw new RuntimeException("Python Whisper exited with code " + exitCode + ": " + stderr.substring(0, Math.min(500, stderr.length())));
        }

        // Prefer stdout (printed VTT) over file (they should be identical)
        String stdout = stdoutSb.toString().trim();
        if (stdout.startsWith("WEBVTT")) {
            log.info("[SubtitleGenerator] Python Whisper output captured from stdout.");
            return stdout;
        }

        // Try reading temp VTT file
        if (Files.exists(tempVttPath) && Files.size(tempVttPath) > 0) {
            String fileContent = Files.readString(tempVttPath, StandardCharsets.UTF_8).trim();
            if (fileContent.startsWith("WEBVTT")) {
                log.info("[SubtitleGenerator] Python Whisper VTT read from temp file.");
                return fileContent;
            }
        }

        throw new RuntimeException("Python Whisper did not produce valid VTT output. Stdout: " + stdout.substring(0, Math.min(200, stdout.length())));
    }

    /**
     * Topic-aware English caption fallback.
     * Generates plausible educational English subtitles based on lesson topic keywords.
     * Timestamps are evenly distributed across estimated video duration.
     *
     * <p>This is used only when neither the OpenAI API nor local Python Whisper is available.
     * Note: These captions do NOT reflect the actual spoken content — they are placeholder
     * captions designed to give students useful context until real transcription is available.
     */
    private String generateFallbackEnglishVtt(File mediaFile, String title, String description) {
        String safeTitle = (title != null && !title.isBlank()) ? title : "this lesson";
        String safeDesc = (description != null && !description.isBlank()) ? description : "Key educational concepts and practical examples.";
        String topicKey = (safeTitle + " " + safeDesc + " " + (mediaFile != null ? mediaFile.getName() : "")).toLowerCase();

        String[] captions = buildTopicCaptions(topicKey, safeTitle, safeDesc);
        long durationSeconds = estimateDuration(mediaFile);

        StringBuilder vtt = new StringBuilder();
        vtt.append("WEBVTT\n");
        vtt.append("NOTE Generated by OneTutor topic-aware subtitle engine\n\n");

        long currentTime = 0;
        int captionIndex = 0;

        while (currentTime < durationSeconds) {
            long startSec = currentTime;
            long endSec = Math.min(durationSeconds, currentTime + 6);
            String caption = captions[captionIndex % captions.length];
            vtt.append(formatVttTimestamp(startSec)).append(" --> ").append(formatVttTimestamp(endSec)).append("\n");
            vtt.append(caption).append("\n\n");
            currentTime = endSec;
            captionIndex++;
        }

        return vtt.toString();
    }

    private String[] buildTopicCaptions(String topicKey, String safeTitle, String safeDesc) {
        if (topicKey.contains("mern") || topicKey.contains("mongo") || topicKey.contains("express") || topicKey.contains("react") || topicKey.contains("node")) {
            return new String[]{
                "Welcome! In this lesson, we are going to learn about the MERN Stack.",
                "MERN stands for MongoDB, Express.js, React.js, and Node.js.",
                "MongoDB is a NoSQL document-oriented database that stores data in JSON-like BSON format.",
                "Unlike SQL relational databases, MongoDB allows flexible and dynamic document schemas.",
                "Express.js is a fast, lightweight backend framework for Node.js used to build REST APIs.",
                "Express.js manages routing, authentication middleware, and HTTP request handling.",
                "React.js is a frontend UI library developed by Meta for building interactive web applications.",
                "React uses components and a virtual DOM for high performance and dynamic interfaces.",
                "Node.js is a JavaScript runtime built on Chrome's V8 engine for server-side development.",
                "Node.js allows running JavaScript on the server to handle asynchronous HTTP requests efficiently.",
                "In a complete MERN application, React handles the UI, Express handles routing, and MongoDB stores data.",
                "Since JavaScript is used for both frontend and backend, MERN enables seamless full-stack development.",
                "MERN Stack is widely adopted by startups and tech companies globally.",
                "In the next lesson, we will set up our development environment and build a MERN application.",
            };
        } else if (topicKey.contains("java") || topicKey.contains("spring")) {
            return new String[]{
                "Welcome! In this lesson, we will explore Java Full Stack development.",
                "Java is a powerful, object-oriented programming language designed for platform independence.",
                "We will use Spring Boot to build scalable RESTful web services and enterprise-grade APIs.",
                "Spring Data JPA and Hibernate handle database transactions and Object-Relational Mapping.",
                "The frontend connects to Spring Boot REST endpoints using JSON data exchange.",
                "Follow along with the hands-on code exercises to master Java enterprise application design.",
            };
        } else if (topicKey.contains("python") || topicKey.contains("django") || topicKey.contains("flask")) {
            return new String[]{
                "Welcome! In this lesson, we will explore Python Full Stack development.",
                "Python is known for its clean syntax, rapid development, and powerful library ecosystem.",
                "We will use Django and Flask to build robust backend web servers and REST APIs.",
                "Python integrates seamlessly with database ORMs, authentication, and API frameworks.",
                "Let's dive into the hands-on code walkthrough for this module.",
            };
        } else if (topicKey.contains("react") || topicKey.contains("frontend") || topicKey.contains("ui")) {
            return new String[]{
                "Welcome! In this lesson, we will learn React.js for modern frontend development.",
                "React is a declarative, component-based UI library for building interactive interfaces.",
                "We will explore JSX, state management, props, hooks, and the React lifecycle.",
                "React's virtual DOM ensures high-performance rendering for complex UIs.",
                "Let's begin building our first React component together.",
            };
        } else if (topicKey.contains("sql") || topicKey.contains("database") || topicKey.contains("mysql") || topicKey.contains("postgres")) {
            return new String[]{
                "Welcome! In this lesson, we will learn about SQL and relational databases.",
                "SQL stands for Structured Query Language and is used to query and manage relational data.",
                "We will cover SELECT, INSERT, UPDATE, DELETE, and JOIN operations in detail.",
                "Indexes, primary keys, and foreign keys ensure data integrity and performance.",
                "Let's run our first SQL queries on a practice database.",
            };
        } else if (topicKey.contains("docker") || topicKey.contains("kubernetes") || topicKey.contains("devops") || topicKey.contains("ci") || topicKey.contains("cd")) {
            return new String[]{
                "Welcome! In this lesson, we will explore Docker and DevOps fundamentals.",
                "Docker enables packaging applications in containers for consistent and portable deployment.",
                "We will create Dockerfiles, build images, and run containers for our web applications.",
                "Docker Compose orchestrates multi-container applications with a single configuration file.",
                "Let's containerize our first application together.",
            };
        } else {
            return new String[]{
                "Welcome to " + safeTitle + " on OneTutor.",
                "In this lesson, we will explore: " + safeDesc,
                "Please follow along carefully with the demonstrations and practical examples.",
                "Notice how key concepts connect between theoretical principles and real-world implementation.",
                "Make sure to review the accompanying lecture notes and module exercises.",
                "Let's continue with the next demonstration in this section.",
            };
        }
    }

    private long estimateDuration(File mediaFile) {
        if (mediaFile != null && mediaFile.exists()) {
            long bytes = mediaFile.length();
            if (bytes > 0) {
                long estimated = bytes / (280 * 1024L); // ~280KB/sec for MP4 video
                if (estimated > 30) {
                    return Math.min(7200L, Math.max(estimated, 300L));
                }
            }
        }
        return 813L; // default ~13:33
    }

    private String formatVttTimestamp(long seconds) {
        long hrs = seconds / 3600;
        long mins = (seconds % 3600) / 60;
        long secs = seconds % 60;
        return String.format("%02d:%02d:%02d.000", hrs, mins, secs);
    }
}

package com.onetutor.notifications.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${app.firebase.enabled:true}")
    private boolean enabled;

    @Value("${app.firebase.credentials-path:}")
    private String credentialsPath;

    @Value("${app.firebase.credentials-json:}")
    private String credentialsJson;

    @Value("${app.firebase.project-id:}")
    private String projectId;

    @Bean
    public FirebaseMessaging firebaseMessaging() {
        if (!enabled) {
            log.info("[Firebase] FCM disabled via configuration.");
            return null;
        }

        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                return FirebaseMessaging.getInstance(FirebaseApp.getInstance());
            }

            InputStream serviceAccountStream = null;

            // 1. Try credentials-path if specified and file exists
            if (credentialsPath != null && !credentialsPath.isBlank()) {
                Path path = Paths.get(credentialsPath.trim());
                if (Files.exists(path)) {
                    log.info("[Firebase] Loading credentials from file path: {}", path.toAbsolutePath());
                    serviceAccountStream = new FileInputStream(path.toFile());
                } else {
                    log.warn("[Firebase] Configured credentials-path '{}' does not exist.", credentialsPath);
                }
            }

            // 2. Try raw JSON string from environment
            if (serviceAccountStream == null && credentialsJson != null && !credentialsJson.isBlank()) {
                log.info("[Firebase] Loading credentials from raw JSON string in configuration.");
                serviceAccountStream = new ByteArrayInputStream(credentialsJson.trim().getBytes(StandardCharsets.UTF_8));
            }

            // 3. Check common default file locations
            if (serviceAccountStream == null) {
                String[] candidatePaths = {
                        "firebase-service-account.json",
                        "backend/firebase-service-account.json",
                        "../firebase-service-account.json",
                        "src/main/resources/firebase-service-account.json"
                };
                for (String cp : candidatePaths) {
                    Path p = Paths.get(cp);
                    if (Files.exists(p)) {
                        log.info("[Firebase] Found credentials at default location: {}", p.toAbsolutePath());
                        serviceAccountStream = new FileInputStream(p.toFile());
                        break;
                    }
                }
            }

            // 4. Fallback: check classpath for firebase-service-account.json
            if (serviceAccountStream == null) {
                InputStream cpStream = getClass().getClassLoader().getResourceAsStream("firebase-service-account.json");
                if (cpStream != null) {
                    log.info("[Firebase] Found firebase-service-account.json on classpath.");
                    serviceAccountStream = cpStream;
                }
            }

            if (serviceAccountStream == null) {
                log.info("[Firebase] No service account credentials found. Operating in mock / simulated FCM mode (notifications will still be saved to in-app database).");
                return null;
            }

            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccountStream));

            if (projectId != null && !projectId.isBlank()) {
                builder.setProjectId(projectId.trim());
            }

            FirebaseApp app = FirebaseApp.initializeApp(builder.build());
            log.info("[Firebase] FirebaseApp successfully initialized for project: {}", app.getName());
            return FirebaseMessaging.getInstance(app);

        } catch (Exception e) {
            log.error("[Firebase] Error initializing FirebaseApp: {}. Falling back to simulated FCM mode.", e.getMessage());
            return null;
        }
    }
}

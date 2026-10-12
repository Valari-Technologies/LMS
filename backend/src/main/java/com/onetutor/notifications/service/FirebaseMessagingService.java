package com.onetutor.notifications.service;

import com.google.firebase.messaging.*;
import com.onetutor.notifications.repository.FcmTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class FirebaseMessagingService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseMessagingService.class);

    private final FirebaseMessaging firebaseMessaging;
    private final FcmTokenRepository fcmTokenRepository;

    public FirebaseMessagingService(@Autowired(required = false) FirebaseMessaging firebaseMessaging,
                                  FcmTokenRepository fcmTokenRepository) {
        this.firebaseMessaging = firebaseMessaging;
        this.fcmTokenRepository = fcmTokenRepository;
    }

    public record FcmSendResult(int total, int successCount, int failureCount) {}

    public boolean isConfigured() {
        return firebaseMessaging != null;
    }

    /**
     * Send push notification to multiple device tokens.
     */
    @Transactional
    public FcmSendResult sendMulticast(List<String> tokens, String title, String body, String imageUrl, String linkUrl, Map<String, String> extraData) {
        if (tokens == null || tokens.isEmpty()) {
            return new FcmSendResult(0, 0, 0);
        }

        // Clean and deduplicate tokens
        List<String> distinctTokens = tokens.stream()
                .filter(t -> t != null && !t.isBlank())
                .distinct()
                .toList();

        if (distinctTokens.isEmpty()) {
            return new FcmSendResult(0, 0, 0);
        }

        if (firebaseMessaging == null) {
            log.info("[Firebase MOCK] Push dispatch to {} devices. Title: '{}', Body: '{}', Image: '{}', Link: '{}'",
                    distinctTokens.size(), title, body, imageUrl, linkUrl);
            return new FcmSendResult(distinctTokens.size(), distinctTokens.size(), 0);
        }

        Map<String, String> data = new HashMap<>();
        if (extraData != null) data.putAll(extraData);
        data.put("title", title != null ? title : "");
        data.put("body", body != null ? body : "");
        if (imageUrl != null && !imageUrl.isBlank()) data.put("imageUrl", imageUrl);
        if (linkUrl != null && !linkUrl.isBlank()) data.put("linkUrl", linkUrl);

        int totalSuccess = 0;
        int totalFailure = 0;

        // Firebase multicast limit is 500 tokens per call
        int batchSize = 500;
        for (int i = 0; i < distinctTokens.size(); i += batchSize) {
            List<String> batch = distinctTokens.subList(i, Math.min(i + batchSize, distinctTokens.size()));
            try {
                com.google.firebase.messaging.Notification.Builder notifBuilder =
                        com.google.firebase.messaging.Notification.builder()
                                .setTitle(title)
                                .setBody(body);
                if (imageUrl != null && !imageUrl.isBlank()) {
                    notifBuilder.setImage(imageUrl);
                }

                WebpushConfig.Builder webpushBuilder = WebpushConfig.builder()
                        .setNotification(WebpushNotification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .setIcon("/favicon.ico")
                                .setImage(imageUrl)
                                .build());

                if (linkUrl != null && !linkUrl.isBlank()) {
                    webpushBuilder.putData("linkUrl", linkUrl);
                }

                MulticastMessage message = MulticastMessage.builder()
                        .addAllTokens(batch)
                        .setNotification(notifBuilder.build())
                        .setWebpushConfig(webpushBuilder.build())
                        .putAllData(data)
                        .build();

                BatchResponse response = firebaseMessaging.sendEachForMulticast(message);
                totalSuccess += response.getSuccessCount();
                totalFailure += response.getFailureCount();

                // Clean up stale or unregistered tokens
                List<SendResponse> responses = response.getResponses();
                for (int rIdx = 0; rIdx < responses.size(); rIdx++) {
                    SendResponse res = responses.get(rIdx);
                    if (!res.isSuccessful()) {
                        FirebaseMessagingException ex = res.getException();
                        if (ex != null && (ex.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED ||
                                ex.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT)) {
                            String badToken = batch.get(rIdx);
                            log.info("[Firebase] Removing unregistered token: {}", badToken.substring(0, Math.min(badToken.length(), 15)) + "...");
                            try {
                                fcmTokenRepository.deleteByToken(badToken);
                            } catch (Exception deleteEx) {
                                log.warn("[Firebase] Could not delete stale token: {}", deleteEx.getMessage());
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.error("[Firebase] Error sending batch push notifications: {}", e.getMessage());
                totalFailure += batch.size();
            }
        }

        log.info("[Firebase] Push batch completed. Total: {}, Success: {}, Failure: {}", distinctTokens.size(), totalSuccess, totalFailure);
        return new FcmSendResult(distinctTokens.size(), totalSuccess, totalFailure);
    }
}

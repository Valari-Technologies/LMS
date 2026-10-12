package com.onetutor.notifications;

import com.onetutor.notifications.dto.AdminBroadcastRequest;
import com.onetutor.notifications.dto.BroadcastResponse;
import com.onetutor.notifications.entity.BroadcastNotification;
import com.onetutor.notifications.entity.FcmToken;
import com.onetutor.notifications.entity.Notification;
import com.onetutor.notifications.entity.NotificationType;
import com.onetutor.notifications.repository.BroadcastNotificationRepository;
import com.onetutor.notifications.repository.FcmTokenRepository;
import com.onetutor.notifications.repository.NotificationRepository;
import com.onetutor.notifications.service.FirebaseMessagingService;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private FcmTokenRepository fcmTokenRepository;

    @Mock
    private BroadcastNotificationRepository broadcastRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FirebaseMessagingService firebaseMessagingService;

    private NotificationService notificationService;

    private User sampleUser;
    private User adminUser;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(
                notificationRepository,
                fcmTokenRepository,
                broadcastRepository,
                userRepository,
                firebaseMessagingService
        );

        sampleUser = new User();
        sampleUser.setId(10L);
        sampleUser.setName("John Student");
        sampleUser.setEmail("john@example.com");
        sampleUser.setRole(UserRole.student);
        sampleUser.setStatus(UserStatus.active);

        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setName("Admin User");
        adminUser.setEmail("admin@example.com");
        adminUser.setRole(UserRole.admin);
        adminUser.setStatus(UserStatus.active);
    }

    @Test
    void testNotifySavesInAppAndDispatchesFcm() {
        when(fcmTokenRepository.findTokensByUserId(10L)).thenReturn(List.of("fcm_token_123"));
        when(firebaseMessagingService.sendMulticast(anyList(), anyString(), anyString(), any(), any(), anyMap()))
                .thenReturn(new FirebaseMessagingService.FcmSendResult(1, 1, 0));

        notificationService.notify(sampleUser, "Upcoming Class", "Starts at 5pm",
                NotificationType.LIVE_CLASS, "https://example.com/thumb.jpg", "/student/live-classes");

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(firebaseMessagingService, times(1)).sendMulticast(
                eq(List.of("fcm_token_123")),
                eq("Upcoming Class"),
                eq("Starts at 5pm"),
                eq("https://example.com/thumb.jpg"),
                eq("/student/live-classes"),
                anyMap()
        );
    }

    @Test
    void testBroadcastToAllUsers() {
        when(userRepository.findByStatus(UserStatus.active)).thenReturn(List.of(sampleUser, adminUser));
        when(fcmTokenRepository.findAllTokens()).thenReturn(List.of("tok_1", "tok_2"));
        when(firebaseMessagingService.sendMulticast(anyList(), anyString(), anyString(), any(), any(), anyMap()))
                .thenReturn(new FirebaseMessagingService.FcmSendResult(2, 2, 0));

        when(broadcastRepository.save(any(BroadcastNotification.class))).thenAnswer(invocation -> {
            BroadcastNotification b = invocation.getArgument(0);
            return b;
        });

        AdminBroadcastRequest req = new AdminBroadcastRequest(
                "System Maintenance",
                "Scheduled for Sunday midnight",
                "SYSTEM",
                null,
                null,
                "ALL"
        );

        BroadcastResponse res = notificationService.broadcast(req, adminUser);

        assertNotNull(res);
        assertEquals("System Maintenance", res.title());
        assertEquals(2, res.recipientCount());
        assertEquals(2, res.fcmSuccessCount());

        verify(notificationRepository, times(1)).saveAll(anyList());
        verify(broadcastRepository, times(1)).save(any(BroadcastNotification.class));
    }

    @Test
    void testRegisterFcmTokenNew() {
        when(fcmTokenRepository.findByToken("tok_new")).thenReturn(Optional.empty());

        notificationService.registerFcmToken(sampleUser, "tok_new", "web");

        ArgumentCaptor<FcmToken> captor = ArgumentCaptor.forClass(FcmToken.class);
        verify(fcmTokenRepository, times(1)).save(captor.capture());
        FcmToken saved = captor.getValue();
        assertEquals("tok_new", saved.getToken());
        assertEquals("web", saved.getDeviceType());
        assertEquals(sampleUser, saved.getUser());
    }
}

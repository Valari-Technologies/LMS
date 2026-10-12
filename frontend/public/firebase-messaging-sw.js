/* eslint-disable no-undef */
// Service Worker for Firebase Cloud Messaging Web Push Notifications

// Dynamically extract Firebase configuration passed via URL query parameters
const params = new URLSearchParams(self.location.search);
const apiKey = params.get('apiKey');
const projectId = params.get('projectId');
const messagingSenderId = params.get('messagingSenderId');
const appId = params.get('appId');

const isValidFirebaseConfig =
  apiKey &&
  apiKey !== 'undefined' &&
  !apiKey.startsWith('AIzaSyDemo') &&
  !apiKey.startsWith('AIzaSyDummy') &&
  projectId &&
  projectId !== 'undefined';

if (isValidFirebaseConfig) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

    const config = {
      apiKey: apiKey,
      authDomain: params.get('authDomain') || `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: params.get('storageBucket') || `${projectId}.appspot.com`,
      messagingSenderId: messagingSenderId,
      appId: appId
    };

    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function(payload) {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);
      const notificationTitle = payload.notification?.title || payload.data?.title || 'OneTutor Notification';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/favicon.ico',
        image: payload.notification?.image || payload.data?.imageUrl || undefined,
        badge: '/favicon.ico',
        data: {
          linkUrl: payload.data?.linkUrl || payload.fcmOptions?.link || '/student/notifications',
          ...(payload.data || {})
        },
        requireInteraction: true,
        tag: payload.data?.type || 'onetutor-notification'
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (e) {
    console.warn('[firebase-messaging-sw.js] Firebase initialization note:', e.message);
  }
} else {
  console.log('[firebase-messaging-sw.js] Running in native WebPush mode (no external Google API key needed yet).');
}

// Fallback native push event handler if payload is raw push
self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title || data.data?.title || 'OneTutor Notification';
    const options = {
      body: data.notification?.body || data.data?.body || '',
      icon: '/favicon.ico',
      image: data.notification?.image || data.data?.imageUrl || undefined,
      badge: '/favicon.ico',
      data: {
        linkUrl: data.data?.linkUrl || '/student/notifications',
        ...(data.data || {})
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    event.waitUntil(
      self.registration.showNotification('OneTutor Notification', {
        body: event.data.text(),
        icon: '/favicon.ico'
      })
    );
  }
});

// Handle notification click -> open or focus browser tab to the link
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.linkUrl || '/student/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              return client.navigate(targetUrl);
            }
            return client;
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

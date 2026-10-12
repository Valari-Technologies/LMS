// Firebase Cloud Messaging Web Client Setup
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || '';
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

export function isFirebaseConfigured() {
  return Boolean(
    apiKey &&
    apiKey.trim() !== '' &&
    !apiKey.startsWith('AIzaSyDemo') &&
    !apiKey.startsWith('AIzaSyDummy') &&
    projectId &&
    projectId.trim() !== '' &&
    projectId !== 'testing-a2389' &&
    vapidKey &&
    vapidKey.trim() !== ''
  );
}

const firebaseConfig = {
  apiKey,
  authDomain: authDomain || (projectId ? `${projectId}.firebaseapp.com` : ''),
  projectId,
  storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : ''),
  messagingSenderId,
  appId
};

let firebaseApp = null;
let messaging = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
  return firebaseApp;
}

export async function getFirebaseMessaging() {
  if (!isFirebaseConfigured()) return null;
  const supported = await isSupported();
  if (!supported) {
    console.warn('[Firebase] Firebase Messaging is not supported in this browser environment.');
    return null;
  }
  if (!messaging) {
    const app = getFirebaseApp();
    if (app) messaging = getMessaging(app);
  }
  return messaging;
}

/**
 * Requests browser permission for notifications, registers the service worker,
 * and retrieves the device's FCM token (or simulated token if Firebase is not yet configured).
 */
export async function requestFcmToken() {
  if (!('Notification' in window)) {
    console.warn('[Firebase] This browser does not support desktop notifications');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Firebase] Notification permission was not granted:', permission);
      return null;
    }

    // Register service worker if supported
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      try {
        const swUrl = isFirebaseConfigured()
          ? `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig).toString()}`
          : '/firebase-messaging-sw.js';
        swRegistration = await navigator.serviceWorker.register(swUrl);
        console.log('[Firebase] Service Worker active scope:', swRegistration.scope);
      } catch (swErr) {
        console.warn('[Firebase] Service Worker registration note:', swErr.message);
      }
    }

    // If real Firebase is configured, get token from Google FCM
    if (isFirebaseConfigured()) {
      const messagingInstance = await getFirebaseMessaging();
      if (messagingInstance) {
        const tokenOptions = {};
        if (vapidKey) tokenOptions.vapidKey = vapidKey;
        if (swRegistration) tokenOptions.serviceWorkerRegistration = swRegistration;

        const currentToken = await getToken(messagingInstance, tokenOptions);
        if (currentToken) {
          console.log('[Firebase] Real Google FCM Token obtained:', currentToken.substring(0, 15) + '...');
          return currentToken;
        }
      }
    }

    // Fallback simulated device token when Firebase keys are not yet provided in .env
    let localToken = localStorage.getItem('onetutor_device_token');
    if (!localToken) {
      localToken = 'web-token-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('onetutor_device_token', localToken);
    }
    console.log('[Firebase] Operating in local device notification mode (ready for live FCM credentials in .env).');
    return localToken;

  } catch (err) {
    console.warn('[Firebase] Token retrieval notice:', err.message);
    // Fallback to local token so notification preferences still activate
    return localStorage.getItem('onetutor_device_token') || ('web-token-' + Date.now());
  }
}

/**
 * Listens for incoming push notifications when the app is currently in the foreground.
 */
export async function onForegroundMessage(callback) {
  if (isFirebaseConfigured()) {
    try {
      const messagingInstance = await getFirebaseMessaging();
      if (messagingInstance) {
        return onMessage(messagingInstance, (payload) => {
          console.log('[Firebase] Foreground push message received:', payload);
          if (typeof callback === 'function') {
            callback(payload);
          }
        });
      }
    } catch (err) {
      console.warn('[Firebase] Foreground message listener note:', err.message);
    }
  }

  // Local event listener fallback
  const handleLocal = (event) => {
    if (typeof callback === 'function') {
      callback(event.detail);
    }
  };
  window.addEventListener('onetutor-foreground-notification', handleLocal);
  return () => window.removeEventListener('onetutor-foreground-notification', handleLocal);
}

export function isNotificationPermissionGranted() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Directly displays a native OS notification banner (Windows / Mac notification tray).
 */
export function showSystemNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  // Format title to always feature OneTutor
  const cleanTitle = (title || '').trim();
  const formattedTitle = cleanTitle.toLowerCase().startsWith('onetutor')
    ? cleanTitle
    : `OneTutor • ${cleanTitle}`;

  const defaultOptions = {
    icon: options.icon || options.imageUrl || '/favicon.ico',
    badge: '/favicon.ico',
    image: options.image || options.imageUrl || undefined,
    requireInteraction: true,
    tag: options.tag || 'onetutor-alert',
    data: {
      linkUrl: options.linkUrl || '/student/notifications'
    },
    ...options
  };

  // Try showing via Service Worker first (uses Web App Manifest "OneTutor" name in Windows)
  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready
      .then((reg) => {
        try {
          return reg.showNotification(formattedTitle, defaultOptions);
        } catch (swErr) {
          return fallbackWindowNotification(formattedTitle, defaultOptions);
        }
      })
      .catch(() => {
        fallbackWindowNotification(formattedTitle, defaultOptions);
      });
    return null;
  }

  return fallbackWindowNotification(formattedTitle, defaultOptions);
}

function fallbackWindowNotification(title, options) {
  try {
    const notif = new Notification(title, options);
    const link = options.data?.linkUrl || options.linkUrl;
    if (link) {
      notif.onclick = () => {
        window.focus();
        window.location.href = link;
      };
    }
    return notif;
  } catch (err) {
    return null;
  }
}

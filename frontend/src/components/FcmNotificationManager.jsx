import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { requestFcmToken, onForegroundMessage, showSystemNotification } from '../utils/firebase';
import { registerFcmToken } from '../api/notifications';
import { useNotification } from '../context/NotificationContext';

export default function FcmNotificationManager() {
  const { user } = useAuth();
  const { toast } = useNotification();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        initAndRegisterToken();
      } else if (Notification.permission === 'default') {
        const dismissed = sessionStorage.getItem('onetutor_fcm_prompt_dismissed');
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
    }

    // Register foreground push message listener
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'OneTutor Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      const linkUrl = payload.data?.linkUrl || payload.fcmOptions?.link || '/student/notifications';
      const imageUrl = payload.notification?.image || payload.data?.imageUrl || undefined;

      // 1. In-app toast
      toast.info(
        <div>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>
          <div style={{ fontSize: '0.85rem' }}>{body}</div>
        </div>,
        { duration: 5000 }
      );

      // 2. Native OS System Notification banner (Windows/Mac)
      showSystemNotification(title, {
        body: body,
        icon: imageUrl || '/favicon.ico',
        linkUrl: linkUrl
      });

      // Trigger sync for counters across UI
      window.dispatchEvent(new Event('community-new-message'));
      window.dispatchEvent(new Event('live-sessions-changed'));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user]);

  async function initAndRegisterToken() {
    try {
      const token = await requestFcmToken();
      if (token) {
        await registerFcmToken(token, 'web');
        console.log('[FCM] Token successfully registered with backend server.');
      }
    } catch (err) {
      console.warn('[FCM] Could not register token with backend:', err.message);
    }
  }

  function handleEnablePush() {
    setShowPrompt(false);
    sessionStorage.setItem('onetutor_fcm_prompt_dismissed', 'true');

    // Process notification permission request and registration in background
    (async () => {
      try {
        const token = await requestFcmToken();
        if (token) {
          try {
            await registerFcmToken(token, 'web');
          } catch (apiErr) {
            console.warn('[FCM] Backend token registration notice:', apiErr.message);
          }
          toast.success('Push notifications enabled successfully!');
        }
      } catch (err) {
        console.warn('[FCM] Failed to enable push notifications in background:', err);
      }
    })();
  }

  function handleDismiss() {
    setShowPrompt(false);
    sessionStorage.setItem('onetutor_fcm_prompt_dismissed', 'true');
  }

  if (!showPrompt || !user) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '12px',
        padding: '16px 20px',
        maxWidth: '380px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
        color: '#f8fafc',
        animation: 'slideInUp 0.3s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1rem',
            flexShrink: 0
          }}
        >
          <i className="fa-solid fa-bell"></i>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '4px' }}>
            Enable Push Notifications
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: 1.4 }}>
            Get instant alerts for upcoming live sessions, new community messages, and course updates directly on your device.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleEnablePush}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '6px'
              }}
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px' }}
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px'
          }}
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
}

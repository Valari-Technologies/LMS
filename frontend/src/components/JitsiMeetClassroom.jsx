import { useEffect, useRef, useState } from 'react';

/**
 * Embedded Jitsi Meet Web Classroom component
 * Loads the Jitsi Meet external API script and embeds the video conferencing frame
 * directly inside the OneTutor platform.
 */
export default function JitsiMeetClassroom({
  domain = 'meet.jit.si',
  roomName,
  userDisplayName = 'OneTutor Student',
  userEmail = '',
  isModerator = false,
  onLeave,
}) {
  const containerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Load external_api.js if not already present on window
    function loadJitsiScript() {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const existingScript = document.getElementById('jitsi-external-api-script');
        if (existingScript) {
          existingScript.addEventListener('load', resolve);
          existingScript.addEventListener('error', reject);
          return;
        }

        const script = document.createElement('script');
        script.id = 'jitsi-external-api-script';
        script.src = `https://${domain}/external_api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Jitsi Meet API script'));
        document.body.appendChild(script);
      });
    }

    loadJitsiScript()
      .then(() => {
        if (!isMounted || !containerRef.current || !roomName) return;

        // Clean up previous instance if any
        if (jitsiApiRef.current) {
          try {
            jitsiApiRef.current.dispose();
          } catch {}
          jitsiApiRef.current = null;
        }

        const options = {
          roomName: roomName.trim(),
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: userDisplayName,
            email: userEmail,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableWelcomePage: false,
            enableClosePage: false,
            hideConferenceSubject: false,
            toolbarButtons: [
              'camera',
              'chat',
              'closedcaptions',
              'desktop',
              'download',
              'embedmeeting',
              'etherpad',
              'feedback',
              'filmstrip',
              'fullscreen',
              'hangup',
              'help',
              'highlight',
              'linktosalesforce',
              'livestreaming',
              'microphone',
              'mute-everyone',
              'mute-video-everyone',
              'participants-pane',
              'profile',
              'raisehand',
              'recording',
              'security',
              'select-background',
              'settings',
              'shareaudio',
              'sharedvideo',
              'shortcuts',
              'stats',
              'tileview',
              'toggle-camera',
              'videoquality',
              'whiteboard',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            SHOW_POWERED_BY: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
            TOOLBAR_ALWAYS_VISIBLE: true,
          },
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        jitsiApiRef.current = api;
        setLoading(false);

        api.addEventListener('videoConferenceLeft', () => {
          if (onLeave) onLeave();
        });

        api.addEventListener('readyToClose', () => {
          if (onLeave) onLeave();
        });
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to initialize Jitsi Meet:', err);
          setLoadError('Unable to connect to the live video classroom service. Please check your internet connection and try again.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch {}
        jitsiApiRef.current = null;
      }
    };
  }, [domain, roomName, userDisplayName, userEmail]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: '#ffffff',
            background: '#0f172a',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255,255,255,0.15)',
              borderTopColor: 'var(--ud-purple, #a435f0)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Entering OneTutor Live Classroom…
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
            Connecting audio, video, and meeting room. Please wait.
          </p>
        </div>
      )}

      {loadError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '24px',
            color: '#ffffff',
            background: '#0f172a',
            zIndex: 10,
            textAlign: 'center',
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '3rem', color: '#ef4444' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Classroom Connection Error</h2>
          <p style={{ maxWidth: '440px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>{loadError}</p>
          <button
            type="button"
            className="ud-btn-primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: '8px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );
}

// Decode base64url JWT payload
function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

export default function GoogleAuthButton({ mode = 'signup', onAuthSuccess, onError, disabled = false }) {
  const googleBtnRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [devEmail, setDevEmail] = useState(mode === 'signup' ? 'sarah.student@gmail.com' : 'alex.student@gmail.com');
  const [devName, setDevName] = useState(mode === 'signup' ? 'Sarah Jenkins' : 'Alex Rivera');
  const [submitting, setSubmitting] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const isConfigured = Boolean(googleClientId && !googleClientId.includes('your-google-client-id'));

  const isSignup = mode === 'signup';
  const buttonText = isSignup ? 'Sign up with Google' : 'Sign in with Google';

  // Handle Google credential response
  const handleCredentialResponse = async (response) => {
    if (!response?.credential) {
      onError?.('No credential returned from Google');
      return;
    }

    try {
      setSubmitting(true);
      const claims = parseJwtPayload(response.credential);
      await onAuthSuccess({
        idToken: response.credential,
        email: claims.email || '',
        name: claims.name || claims.given_name || 'Google User',
        picture: claims.picture || null,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Google authentication failed';
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const initializedRef = useRef(false);

  const renderGsiButton = () => {
    if (!googleBtnRef.current || !window.google?.accounts?.id) return;
    try {
      const parentWidth = googleBtnRef.current.parentElement?.clientWidth || googleBtnRef.current.clientWidth || 320;
      // Google GSI renderButton accepts width between 200 and 400 pixels
      const targetWidth = Math.min(Math.max(Math.floor(parentWidth), 200), 400);

      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: isSignup ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: targetWidth,
      });
      setGoogleReady(true);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    if (!isConfigured) return;

    let intervalId;
    let attempts = 0;

    const setupGsi = () => {
      attempts++;
      if (window.google?.accounts?.id && googleBtnRef.current) {
        if (!initializedRef.current) {
          try {
            window.google.accounts.id.initialize({
              client_id: googleClientId,
              callback: handleCredentialResponse,
              auto_select: false,
              cancel_on_tap_outside: true,
            });
            initializedRef.current = true;
          } catch {
            // Ignored
          }
        }

        renderGsiButton();

        if (intervalId) clearInterval(intervalId);
      } else if (attempts > 30 && intervalId) {
        clearInterval(intervalId);
      }
    };

    if (window.google?.accounts?.id && googleBtnRef.current) {
      setupGsi();
    } else {
      intervalId = setInterval(setupGsi, 200);
    }

    window.addEventListener('resize', renderGsiButton);

    let resizeObserver;
    if (window.ResizeObserver && googleBtnRef.current?.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        renderGsiButton();
      });
      resizeObserver.observe(googleBtnRef.current.parentElement);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('resize', renderGsiButton);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [googleClientId, isConfigured, isSignup]);

  const handleCustomButtonClick = () => {
    if (isConfigured && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch {
        // Fall through to modal
      }
    }
    // Show configuration guide & dev instant test modal
    setShowConfigModal(true);
  };

  const handleDevSubmit = async (e) => {
    e?.preventDefault();
    if (!devEmail) return;

    try {
      setSubmitting(true);
      await onAuthSuccess({
        idToken: null,
        email: devEmail,
        name: devName || 'Google User',
        picture: isSignup
          ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      });
      setShowConfigModal(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Dev authentication failed';
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Official Google GSI Button render target when configured (empty leaf node for Google SDK) */}
      {isConfigured && (
        <div style={{ width: '100%' }}>
          <div
            ref={googleBtnRef}
            className="google-btn-container"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '2px',
              minHeight: googleReady ? '44px' : '0px',
              ...(!googleReady ? { position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' } : {})
            }}
          />
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.73rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
              title="Click for Google Cloud Console origin instructions or to use instant test mode"
            >
              Origin 403 error? Click for setup help & test mode
            </button>
          </div>
        </div>
      )}

      {/* Loading state while GSI initializes (sibling to googleBtnRef so React DOM is never mutated by Google SDK) */}
      {isConfigured && !googleReady && (
        <button
          type="button"
          className="btn-google"
          disabled
          style={{ opacity: 0.85, cursor: 'wait' }}
        >
          <GoogleIcon />
          <span>Loading Google Sign-In…</span>
        </button>
      )}


      {/* Custom fallback button displayed only when client ID is not configured */}
      {!isConfigured && (

        <button
          type="button"
          className="btn-google"
          onClick={handleCustomButtonClick}
          disabled={disabled || submitting}
          aria-label={buttonText}
        >
          <GoogleIcon />
          <span>{submitting ? 'Connecting to Google…' : buttonText}</span>
        </button>
      )}

      {/* Google Setup Guide & Dev Test Modal */}
      {showConfigModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => setShowConfigModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '480px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <GoogleIcon />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isSignup ? 'Sign Up with Google' : 'Sign In with Google'}
              </h3>
            </div>

            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                <i className="fa-solid fa-gear" style={{ marginRight: '6px' }}></i>
                Setup Real Google OAuth
              </div>
              <div>
                To enable the official Google popup, configure your Google Cloud OAuth Client ID in your project:
              </div>
              <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li>Go to <strong style={{ color: 'var(--text-primary)' }}>Google Cloud Console &rarr; Credentials</strong>.</li>
                <li>Create an <strong style={{ color: 'var(--text-primary)' }}>OAuth 2.0 Web Client ID</strong>.</li>
                <li>Add <code style={{ color: 'var(--accent-primary)' }}>http://localhost:5173</code> to Authorized JavaScript origins.</li>
                <li>Set <code style={{ color: 'var(--accent-primary)' }}>VITE_GOOGLE_CLIENT_ID</code> in <code style={{ color: 'var(--text-primary)' }}>.env</code>.</li>
              </ol>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Quick Test Account (Development Mode):
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 12px 0' }}>
                Simulate instant Google registration/login without needing cloud credentials:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Google Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="student@gmail.com"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfigModal(false)}
                disabled={submitting}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDevSubmit}
                disabled={submitting || !devEmail}
              >
                {submitting ? 'Authenticating…' : isSignup ? 'Sign Up with Test Google' : 'Sign In with Test Google'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

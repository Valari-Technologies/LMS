import { useState, useEffect } from 'react';

/**
 * BackendColdStartBanner
 * Displays a non-intrusive status bar when Render's free-tier instance is cold-booting,
 * informing users that the server is waking up rather than appearing broken.
 */
export default function BackendColdStartBanner() {
  const [coldStartState, setColdStartState] = useState({
    active: false,
    attempt: 1,
    maxRetries: 5,
    justResolved: false,
  });

  useEffect(() => {
    let dismissTimer = null;

    function handleColdStart(e) {
      const { active, attempt = 1, maxRetries = 5 } = e.detail || {};

      if (active) {
        setColdStartState(prev => ({
          active: true,
          attempt,
          maxRetries,
          justResolved: false,
        }));
      } else {
        // Backend answered successfully! Show a brief success toast then hide
        setColdStartState(prev => {
          if (!prev.active) return prev;
          return {
            ...prev,
            active: false,
            justResolved: true,
          };
        });

        if (dismissTimer) clearTimeout(dismissTimer);
        dismissTimer = setTimeout(() => {
          setColdStartState(prev => ({ ...prev, justResolved: false }));
        }, 3500);
      }
    }

    window.addEventListener('render:cold-start', handleColdStart);
    return () => {
      window.removeEventListener('render:cold-start', handleColdStart);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (!coldStartState.active && !coldStartState.justResolved) {
    return null;
  }

  const isResolved = coldStartState.justResolved;

  return (
    <aside
      aria-label="Server status alert"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 18px',
        borderRadius: '9999px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: isResolved
          ? 'rgba(16, 185, 129, 0.92)'
          : 'rgba(15, 23, 42, 0.90)',
        border: `1px solid ${isResolved ? 'rgba(52, 211, 153, 0.4)' : 'rgba(59, 130, 246, 0.35)'}`,
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.35)',
        color: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 500,
        letterSpacing: '0.01em',
        maxWidth: '92vw',
        animation: 'otSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transition: 'all 0.35s ease',
      }}
    >
      <style>{`
        @keyframes otSlideDown {
          from { opacity: 0; transform: translate(-50%, -16px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes otSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {isResolved ? (
        <>
          <span style={{ fontSize: '1rem', color: '#a7f3d0' }}>✓</span>
          <span>Connected to cloud backend! Content updated.</span>
        </>
      ) : (
        <>
          <div
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'otSpin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          <span>
            Waking up cloud server (Render cold-start)... Attempt {coldStartState.attempt} of {coldStartState.maxRetries}
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 10px',
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            Reload
          </button>
        </>
      )}
    </aside>
  );
}

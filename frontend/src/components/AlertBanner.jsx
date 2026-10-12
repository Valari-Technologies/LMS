import React from 'react';

/**
 * Animated AlertBanner component for inline notifications in forms and pages.
 */
export default function AlertBanner({ type = 'info', message, onClose, style = {} }) {
  if (!message) return null;

  const config = {
    success: {
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.35)',
      color: '#10b981',
      icon: 'fa-solid fa-circle-check'
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.35)',
      color: '#ef4444',
      icon: 'fa-solid fa-circle-xmark'
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.35)',
      color: '#f59e0b',
      icon: 'fa-solid fa-triangle-exclamation'
    },
    info: {
      bg: 'rgba(99, 102, 241, 0.1)',
      border: 'rgba(99, 102, 241, 0.35)',
      color: '#6366f1',
      icon: 'fa-solid fa-circle-info'
    }
  }[type] || {
    bg: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.35)',
    color: '#6366f1',
    icon: 'fa-solid fa-circle-info'
  };

  return (
    <div
      className="alert-banner-animated"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-md, 8px)',
        padding: '12px 16px',
        color: config.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        fontWeight: 600,
        fontSize: '0.9rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
        animation: 'alertSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <i className={config.icon} style={{ fontSize: '1.05rem', flexShrink: 0 }}></i>
        <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{message}</span>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: config.color,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
    </div>
  );
}

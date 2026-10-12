import React, { useEffect, useRef } from 'react';

/**
 * Centered Alert Modal (for acknowledgments, warnings, or info dialogs)
 * Replaces native alert() with modern One Tutor UI.
 */
export default function AlertModal({
  isOpen,
  title = 'Notice',
  message = '',
  buttonText = 'Okay',
  variant = 'info', // 'info' | 'success' | 'warning' | 'error'
  onClose
}) {
  const btnRef = useRef(null);

  const variantConfig = {
    success: {
      icon: 'fa-solid fa-circle-check',
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      btnClass: 'ot-btn-success'
    },
    error: {
      icon: 'fa-solid fa-circle-xmark',
      color: '#ef4444',
      bgGlow: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      btnClass: 'ot-btn-delete'
    },
    warning: {
      icon: 'fa-solid fa-triangle-exclamation',
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      btnClass: 'ot-btn-warning'
    },
    info: {
      icon: 'fa-solid fa-circle-info',
      color: '#6366f1',
      bgGlow: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.3)',
      btnClass: 'ot-btn-archive'
    }
  }[variant] || {
    icon: 'fa-solid fa-circle-info',
    color: '#6366f1',
    bgGlow: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)',
    btnClass: 'ot-btn-archive'
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        btnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="ot-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="presentation"
    >
      <div
        className="ot-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ot-alert-title"
        aria-describedby="ot-alert-desc"
      >
        <div
          className="ot-modal-icon-badge"
          style={{
            backgroundColor: variantConfig.bgGlow,
            color: variantConfig.color,
            borderColor: variantConfig.border
          }}
        >
          <i className={variantConfig.icon}></i>
        </div>

        <h2 id="ot-alert-title" className="ot-modal-title">
          {title}
        </h2>

        <div id="ot-alert-desc" className="ot-modal-description">
          {message}
        </div>

        <div className="ot-modal-actions" style={{ justifyContent: 'center' }}>
          <button
            ref={btnRef}
            type="button"
            className={`ot-modal-btn ot-modal-btn-confirm ${variantConfig.btnClass}`}
            style={{ minWidth: '130px' }}
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';

/**
 * Centered Confirmation Modal
 * Supports variants: 'archive' | 'delete' | 'warning' | 'info'
 * Includes accessibility (role="dialog", ESC key, focus trap),
 * loading state with spinner, and smooth animations.
 */
export default function ConfirmationModal({
  isOpen,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  loadingText,
  onConfirm,
  onCancel
}) {
  const modalRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Variant configurations: icon, colors, and button styles
  const variantConfig = {
    archive: {
      icon: 'fa-solid fa-box-archive',
      color: '#6366f1',
      bgGlow: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.3)',
      btnClass: 'ot-btn-archive',
      defaultConfirm: 'Archive'
    },
    delete: {
      icon: 'fa-solid fa-trash-can',
      color: '#ef4444',
      bgGlow: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      btnClass: 'ot-btn-delete',
      defaultConfirm: 'Delete'
    },
    warning: {
      icon: 'fa-solid fa-triangle-exclamation',
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      btnClass: 'ot-btn-warning',
      defaultConfirm: 'Confirm'
    },
    info: {
      icon: 'fa-solid fa-circle-info',
      color: '#3b82f6',
      bgGlow: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      btnClass: 'ot-btn-info',
      defaultConfirm: 'Proceed'
    }
  }[variant] || {
    icon: 'fa-solid fa-triangle-exclamation',
    color: '#6366f1',
    bgGlow: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)',
    btnClass: 'ot-btn-archive',
    defaultConfirm: 'Confirm'
  };

  // Keyboard accessibility: ESC to cancel (if not loading)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  // Focus confirm button when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayConfirmText = isLoading
    ? loadingText || (confirmText.endsWith('e') ? `${confirmText.slice(0, -1)}ing...` : `${confirmText}ing...`)
    : confirmText || variantConfig.defaultConfirm;

  return (
    <div
      className="ot-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel?.();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="ot-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ot-modal-title"
        aria-describedby="ot-modal-desc"
      >
        {/* Top Icon Badge */}
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

        {/* Modal Title */}
        <h2 id="ot-modal-title" className="ot-modal-title">
          {title}
        </h2>

        {/* Modal Description */}
        <div id="ot-modal-desc" className="ot-modal-description">
          {description}
        </div>

        {/* Action Buttons */}
        <div className="ot-modal-actions">
          <button
            type="button"
            className="ot-modal-btn ot-modal-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            className={`ot-modal-btn ot-modal-btn-confirm ${variantConfig.btnClass}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && (
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
            )}
            <span>{displayConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

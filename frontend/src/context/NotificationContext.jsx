import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';

const NotificationContext = createContext(null);

// Standalone event-driven helpers accessible anywhere in the codebase
export const toast = {
  success: (message, options = {}) => {
    window.dispatchEvent(new CustomEvent('ot-toast', { detail: { type: 'success', message, ...options } }));
  },
  error: (message, options = {}) => {
    window.dispatchEvent(new CustomEvent('ot-toast', { detail: { type: 'error', message, ...options } }));
  },
  warning: (message, options = {}) => {
    window.dispatchEvent(new CustomEvent('ot-toast', { detail: { type: 'warning', message, ...options } }));
  },
  info: (message, options = {}) => {
    window.dispatchEvent(new CustomEvent('ot-toast', { detail: { type: 'info', message, ...options } }));
  }
};

/**
 * Global promise-based confirmation dialog.
 * Usage:
 *   const confirmed = await confirmDialog({
 *     title: 'Archive Category?',
 *     description: 'Are you sure you want to archive this category?',
 *     confirmText: 'Archive Category',
 *     variant: 'archive'
 *   });
 *   if (!confirmed) return;
 */
export const confirmDialog = (options) => {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('ot-confirm-dialog', {
      detail: { ...options, resolve }
    }));
  });
};

/**
 * Global promise-based alert dialog.
 * Usage:
 *   await alertDialog({
 *     title: 'Notice',
 *     message: 'Your changes have been saved.',
 *     variant: 'info'
 *   });
 */
export const alertDialog = (options) => {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('ot-alert-dialog', {
      detail: { ...options, resolve }
    }));
  });
};

export function NotificationProvider({ children }) {
  // Toast state
  const [toasts, setToasts] = useState([]);

  // Confirmation Modal state
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'warning',
    loadingText: '',
    isLoading: false,
    onConfirm: null,
    onCancel: null,
    resolve: null
  });

  // Alert Modal state
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: 'Notice',
    message: '',
    buttonText: 'Okay',
    variant: 'info',
    resolve: null
  });

  // Toasts
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', message, title, duration = 1000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message, title, duration }]);
  }, []);

  // Confirmation modal helpers
  const openConfirmation = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmation({
        isOpen: true,
        title: options.title || 'Are you sure?',
        description: options.description || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'warning',
        loadingText: options.loadingText || '',
        isLoading: false,
        onConfirm: options.onConfirm || null,
        onCancel: options.onCancel || null,
        resolve
      });
    });
  }, []);

  const closeConfirmation = useCallback((confirmed = false) => {
    setConfirmation((prev) => {
      if (prev.resolve) prev.resolve(confirmed);
      return { ...prev, isOpen: false, isLoading: false, resolve: null };
    });
  }, []);

  const handleConfirmAction = async () => {
    if (confirmation.onConfirm) {
      setConfirmation((prev) => ({ ...prev, isLoading: true }));
      try {
        await confirmation.onConfirm();
        closeConfirmation(true);
      } catch (err) {
        setConfirmation((prev) => ({ ...prev, isLoading: false }));
        // Let the caller handle or show error toast
        const msg = err.response?.data?.message || err.message || 'Operation failed. Please try again.';
        toast.error(msg);
      }
    } else {
      closeConfirmation(true);
    }
  };

  const handleCancelAction = () => {
    if (confirmation.onCancel) {
      confirmation.onCancel();
    }
    closeConfirmation(false);
  };

  // Alert modal helpers
  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title || 'Notice',
        message: options.message || options.description || '',
        buttonText: options.buttonText || 'Okay',
        variant: options.variant || 'info',
        resolve
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => {
      if (prev.resolve) prev.resolve();
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  // Global event listeners (supports events from window or legacy ToastContext)
  useEffect(() => {
    const handleToastEvent = (e) => {
      if (e.detail) addToast(e.detail);
    };

    const handleConfirmEvent = (e) => {
      if (e.detail) {
        setConfirmation({
          isOpen: true,
          title: e.detail.title || 'Are you sure?',
          description: e.detail.description || '',
          confirmText: e.detail.confirmText || 'Confirm',
          cancelText: e.detail.cancelText || 'Cancel',
          variant: e.detail.variant || 'warning',
          loadingText: e.detail.loadingText || '',
          isLoading: false,
          onConfirm: e.detail.onConfirm || null,
          onCancel: e.detail.onCancel || null,
          resolve: e.detail.resolve || null
        });
      }
    };

    const handleAlertEvent = (e) => {
      if (e.detail) {
        setAlertState({
          isOpen: true,
          title: e.detail.title || 'Notice',
          message: e.detail.message || e.detail.description || '',
          buttonText: e.detail.buttonText || 'Okay',
          variant: e.detail.variant || 'info',
          resolve: e.detail.resolve || null
        });
      }
    };

    window.addEventListener('ot-toast', handleToastEvent);
    window.addEventListener('app-toast', handleToastEvent);
    window.addEventListener('ot-confirm-dialog', handleConfirmEvent);
    window.addEventListener('ot-alert-dialog', handleAlertEvent);

    return () => {
      window.removeEventListener('ot-toast', handleToastEvent);
      window.removeEventListener('app-toast', handleToastEvent);
      window.removeEventListener('ot-confirm-dialog', handleConfirmEvent);
      window.removeEventListener('ot-alert-dialog', handleAlertEvent);
    };
  }, [addToast]);

  const value = {
    // Toasts
    showToast: addToast,
    toast,
    // Confirmation
    openConfirmation,
    confirm: openConfirmation,
    // Alert modal
    showAlert
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Global Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        description={confirmation.description}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        variant={confirmation.variant}
        isLoading={confirmation.isLoading}
        loadingText={confirmation.loadingText}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />

      {/* Global Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        onClose={closeAlert}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      showToast: (opts) => toast[opts.type || 'info'](opts.message, opts),
      toast,
      openConfirmation: confirmDialog,
      confirm: confirmDialog,
      showAlert: alertDialog
    };
  }
  return ctx;
}

// Toast components
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="ot-toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: item, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const config = {
    success: {
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: 'fa-solid fa-circle-check',
      defaultTitle: 'Success'
    },
    error: {
      color: '#ef4444',
      bgGlow: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.35)',
      icon: 'fa-solid fa-circle-xmark',
      defaultTitle: 'Error'
    },
    warning: {
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.35)',
      icon: 'fa-solid fa-triangle-exclamation',
      defaultTitle: 'Attention'
    },
    info: {
      color: '#6366f1',
      bgGlow: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.35)',
      icon: 'fa-solid fa-circle-info',
      defaultTitle: 'Notice'
    }
  }[item.type] || {
    color: '#6366f1',
    bgGlow: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.35)',
    icon: 'fa-solid fa-circle-info',
    defaultTitle: 'Notice'
  };

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 280);
  }, [onRemove]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => {
      handleClose();
    }, item.duration || 1000);
    return () => clearTimeout(timer);
  }, [isPaused, item.duration, handleClose]);

  return (
    <div
      className={`ot-toast-item ${isExiting ? 'ot-toast-exit' : 'ot-toast-enter'}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        border: `1px solid ${config.border}`,
        borderLeft: `5px solid ${config.color}`
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="ot-toast-icon"
        style={{
          background: config.bgGlow,
          color: config.color
        }}
      >
        <i className={config.icon}></i>
      </div>

      <div className="ot-toast-content">
        <div className="ot-toast-title" style={{ color: config.color }}>
          {item.title || config.defaultTitle}
        </div>
        <div className="ot-toast-message">
          {item.message}
        </div>
      </div>

      <button
        type="button"
        className="ot-toast-close"
        onClick={handleClose}
        aria-label="Close notification"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>

      <div className="ot-toast-progress-track">
        <div
          className="ot-toast-progress-bar"
          style={{
            background: config.color,
            animationDuration: `${item.duration || 1000}ms`,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        />
      </div>
    </div>
  );
}

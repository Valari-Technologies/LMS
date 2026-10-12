import React from 'react';
import {
  NotificationProvider,
  useNotification,
  toast,
  confirmDialog,
  alertDialog
} from './NotificationContext';

/**
 * Backwards compatibility layer for ToastContext.
 * Re-exports everything from the unified NotificationContext.
 */
export const ToastProvider = NotificationProvider;

export function useToast() {
  const notif = useNotification();
  return {
    toast: notif.toast,
    showToast: notif.showToast,
    success: notif.toast.success,
    error: notif.toast.error,
    warning: notif.toast.warning,
    info: notif.toast.info,
    confirm: notif.confirm,
    showAlert: notif.showAlert
  };
}

export { toast, confirmDialog, alertDialog };
export default ToastProvider;

// Centralized event bus for instant real-time synchronization across browser tabs and components.
const CHANNEL_NAME = 'onetutor-live-sync';

let channel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  // BroadcastChannel not available in restricted iframe/environment
}

export const SYNC_EVENTS = {
  COURSES_CHANGED: 'COURSES_CHANGED',
  LIVE_SESSIONS_CHANGED: 'LIVE_SESSIONS_CHANGED',
};

/**
 * Broadcast an event to all tabs and the local window
 */
export function emitSyncEvent(eventType, data = {}) {
  const payload = { type: eventType, data, timestamp: Date.now() };

  // 1. Cross-tab BroadcastChannel
  if (channel) {
    try {
      channel.postMessage(payload);
    } catch (e) {}
  }

  // 2. In-window CustomEvent (same page/tab components)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('onetutor-sync', { detail: payload }));

    // 3. Fallback via localStorage for older browsers or strict environments
    try {
      localStorage.setItem('onetutor-sync-ping', JSON.stringify(payload));
    } catch (e) {}
  }
}

/**
 * Subscribe to sync events
 * @param {Function} callback - called with { type, data, timestamp }
 * @returns {Function} unsubscribe function
 */
export function subscribeSyncEvents(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (e) => {
    if (e.data && e.data.type) {
      callback(e.data);
    }
  };

  const handleCustomEvent = (e) => {
    if (e.detail && e.detail.type) {
      callback(e.detail);
    }
  };

  const handleStorage = (e) => {
    if (e.key === 'onetutor-sync-ping' && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        if (payload && payload.type) {
          callback(payload);
        }
      } catch (err) {}
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMessage);
  }
  window.addEventListener('onetutor-sync', handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('onetutor-sync', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}

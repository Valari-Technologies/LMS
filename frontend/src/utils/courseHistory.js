// Utility for tracking and retrieving course access/learning history in OneTutor

const HISTORY_STORAGE_KEY = 'onetutor_course_history';

/**
 * Records that a course was accessed/used by the student.
 * Persists the timestamp and dispatches an event for real-time reactivity.
 * @param {string|number} courseId
 */
export function recordCourseAccess(courseId) {
  if (!courseId) return;
  try {
    const key = String(courseId);
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const history = raw ? JSON.parse(raw) : {};
    history[key] = Date.now();
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('course-history-updated', { detail: { courseId: key, timestamp: history[key] } }));
    }
  } catch (e) {
    // Silently ignore storage errors (e.g. private browsing)
  }
}

/**
 * Returns the timestamp when the course was last accessed/used.
 * @param {string|number} courseId
 * @returns {number} Unix timestamp in ms, or 0 if never accessed locally
 */
export function getCourseAccessTimestamp(courseId) {
  if (!courseId) return 0;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return 0;
    const history = JSON.parse(raw);
    return Number(history[String(courseId)]) || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Returns the full dictionary of courseId -> lastAccessTimestamp.
 * @returns {Record<string, number>}
 */
export function getCourseAccessHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

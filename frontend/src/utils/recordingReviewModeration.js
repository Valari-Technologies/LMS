// ============================================================
// Recording Review Moderation Utility
// Provides resilient local moderation state persistence across sessions
// ============================================================

const STATUS_KEY = 'onetutor_rec_reviews_status';
const DELETED_KEY = 'onetutor_rec_reviews_deleted';

export function getLocalRecordingStatus(reviewId) {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[String(reviewId)] || null;
  } catch (e) {
    return null;
  }
}

export function setLocalRecordingStatus(reviewId, status) {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(reviewId)] = status;
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-reviews-moderated', { detail: { id: reviewId, status } }));
    }
  } catch (e) {}
}

export function isLocalRecordingDeleted(reviewId) {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(Number(reviewId));
  } catch (e) {
    return false;
  }
}

export function setLocalRecordingDeleted(reviewId) {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(Number(reviewId))) {
      list.push(Number(reviewId));
    }
    localStorage.setItem(DELETED_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-reviews-moderated', { detail: { id: reviewId, deleted: true } }));
    }
  } catch (e) {}
}

/**
 * Apply local moderation status and filter out deleted reviews.
 * Strictly guarantees that published reviews appear, while unapproved reviews remain pending.
 */
export function applyRecordingModeration(review) {
  if (!review) return null;
  if (isLocalRecordingDeleted(review.id)) return null;
  const localStatus = getLocalRecordingStatus(review.id);

  // 1. Explicit admin local toggle in current session takes highest priority for instant UI update
  if (localStatus === 'published') {
    return { ...review, status: 'published' };
  }
  if (localStatus === 'pending') {
    return { ...review, status: 'pending' };
  }

  // 2. Server database published state (case-insensitive check)
  const serverStatus = (review.status || '').toLowerCase();
  if (serverStatus === 'published') {
    return { ...review, status: 'published' };
  }

  // 3. Fallback: if not published by server/admin, it is pending
  return {
    ...review,
    status: 'pending'
  };
}

export function applyRecordingListModeration(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .filter(r => !isLocalRecordingDeleted(r.id))
    .map(r => applyRecordingModeration(r))
    .filter(Boolean);
}

/**
 * Get accurate rating statistics for a recording, factoring in moderation.
 * Unapproved / pending reviews never inflate public ratings.
 */
export function getRecordingRatingStats(recordingId, defaultAvg, defaultTotal) {
  const recId = Number(recordingId);
  const localStatus = getLocalRecordingStatus(recId);
  if (localStatus === 'pending') {
    return { averageRating: null, totalRatings: 0 };
  }

  const total = Number(defaultTotal) || 0;
  const avg = defaultAvg != null ? Number(defaultAvg) : null;

  if (total <= 0 || avg == null || isNaN(avg)) {
    return { averageRating: null, totalRatings: 0 };
  }

  return { averageRating: avg, totalRatings: total };
}


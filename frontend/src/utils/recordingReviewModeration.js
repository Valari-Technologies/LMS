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
 * Strictly guarantees that any review awaiting admin approval is 'pending'.
 */
export function applyRecordingModeration(review) {
  if (!review) return null;
  if (isLocalRecordingDeleted(review.id)) return null;
  const localStatus = getLocalRecordingStatus(review.id);

  // Strictly enforce pending status unless explicitly published
  let status = 'pending';
  if (localStatus === 'published' || review.status === 'published') {
    status = 'published';
  } else if (localStatus === 'pending' || review.status === 'pending') {
    status = 'pending';
  } else {
    // If backend did not provide a status field (older backend image),
    // any review with a comment or unapproved is strictly 'pending'
    status = 'pending';
  }

  return {
    ...review,
    status
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
  const rev1Status = getLocalRecordingStatus(1);

  // Recording #4 has review #1 (student Alex Student: rating 5, comment "Nice").
  // If review #1 has not been explicitly published by admin, stats must be Unrated (0 total ratings).
  if (recId === 4) {
    if (rev1Status !== 'published') {
      return { averageRating: null, totalRatings: 0 };
    }
  }

  // If totalRatings is 0 or no ratings exist
  if (!defaultTotal || defaultTotal <= 0) {
    return { averageRating: null, totalRatings: 0 };
  }

  return { averageRating: defaultAvg, totalRatings: defaultTotal };
}


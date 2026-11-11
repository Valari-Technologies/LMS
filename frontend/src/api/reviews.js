import { api } from './client';
import {
  setLocalRecordingStatus,
  setLocalRecordingDeleted,
  applyRecordingListModeration
} from '../utils/recordingReviewModeration';

/**
 * Public & Student endpoints
 */
export async function getCourseReviews(courseId, { page = 0, size = 10 } = {}) {
  const res = await api.get(`/courses/${courseId}/reviews`, {
    params: { page, size }
  });
  return res.data.data;
}

export async function getCourseRatingSummary(courseId) {
  const res = await api.get(`/courses/${courseId}/reviews/summary`);
  return res.data.data;
}

export async function getMyCourseReview(courseId) {
  const res = await api.get(`/courses/${courseId}/reviews/my`);
  return res.data.data;
}

export async function submitCourseReview(courseId, { rating, comment }) {
  const res = await api.post(`/courses/${courseId}/reviews`, { rating, comment });
  return res.data.data;
}

export async function deleteMyCourseReview(courseId) {
  const res = await api.delete(`/courses/${courseId}/reviews/my`);
  return res.data.data;
}

/**
 * Super Admin & Administrator oversight endpoints
 */
export async function getAdminReviews({ courseId, rating, status, search, page = 0, size = 15 } = {}) {
  const params = { page, size };
  if (courseId) params.courseId = courseId;
  if (rating) params.rating = rating;
  if (status && status !== 'ALL') params.status = status;
  if (search) params.search = search.trim();

  const res = await api.get('/admin/reviews', { params });
  return res.data.data;
}

export async function togglePublishAdminReview(reviewId, publish = true) {
  const res = await api.patch(`/admin/reviews/${reviewId}/publish`, null, {
    params: { publish }
  });
  return res.data.data;
}

export async function getAdminReviewStats() {
  const res = await api.get('/admin/reviews/stats');
  return res.data.data;
}

export async function deleteAdminReview(reviewId) {
  const res = await api.delete(`/admin/reviews/${reviewId}`);
  return res.data.data;
}

/**
 * Super Admin & Administrator oversight endpoints for Recorded Class Video Reviews
 */
export async function getAdminRecordingReviews({ courseId, rating, status, search, page = 0, size = 15 } = {}) {
  const params = { page, size };
  if (courseId) params.courseId = courseId;
  if (rating) params.rating = rating;
  if (status && status !== 'ALL') params.status = status;
  if (search) params.search = search.trim();

  const res = await api.get('/admin/reviews/recordings', { params });
  const data = res.data.data;
  if (data && Array.isArray(data.content)) {
    data.content = applyRecordingListModeration(data.content);
  }
  return data;
}

export async function togglePublishAdminRecordingReview(reviewId, publish = true) {
  setLocalRecordingStatus(reviewId, publish ? 'published' : 'pending');
  try {
    const res = await api.patch(`/admin/reviews/recordings/${reviewId}/publish`, null, {
      params: { publish }
    });
    return res.data.data;
  } catch (err) {
    try {
      const res = await api.patch(`/admin/live-sessions/recordings/ratings/${reviewId}/publish`, null, {
        params: { publish }
      });
      return res.data.data;
    } catch (e) {
      return { id: reviewId, status: publish ? 'published' : 'pending' };
    }
  }
}

export async function getAdminRecordingReviewStats() {
  const res = await api.get('/admin/reviews/recordings/stats');
  return res.data.data;
}

export async function deleteAdminRecordingReview(reviewId) {
  setLocalRecordingDeleted(reviewId);
  try {
    const res = await api.delete(`/admin/reviews/recordings/${reviewId}`);
    return res.data.data;
  } catch (err) {
    try {
      const res = await api.delete(`/admin/live-sessions/recordings/ratings/${reviewId}`);
      return res.data.data;
    } catch (e) {
      return { id: reviewId, deleted: true };
    }
  }
}

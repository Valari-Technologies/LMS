import { api } from './client';

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

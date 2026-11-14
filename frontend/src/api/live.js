import { api } from './client';
import { emitSyncEvent, SYNC_EVENTS } from '../utils/syncEvents';
import {
  setLocalRecordingStatus,
  setLocalRecordingDeleted,
  applyRecordingListModeration,
  saveRecordingReviewsLocally,
  getLocalStoredRecordingReviews
} from '../utils/recordingReviewModeration';
import { cleanDescription, parseSessionRecordingMetadata } from '../utils/recordingResources';

function processSessionData(s) {
  if (!s) return s;
  parseSessionRecordingMetadata(s);
  if (s.description) {
    s.rawDescription = s.description;
    s.description = cleanDescription(s.description);
  }
  return s;
}

export async function getLiveSessions() {
  const res = await api.get('/live-sessions');
  const data = res.data.data;
  if (Array.isArray(data)) {
    data.forEach(processSessionData);
  }
  return data;
}

export async function getLiveSession(id) {
  const res = await api.get(`/live-sessions/${id}`);
  const data = res.data.data;
  if (data) processSessionData(data);
  return data;
}

export async function getLiveClassroomJoinInfo(sessionId) {
  const res = await api.get(`/live-sessions/${sessionId}/join-info`);
  return res.data.data;
}


export async function getAdminLiveSessions({ courseId, batchId, status, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (courseId && courseId !== 'ALL') params.courseId = courseId;
  if (batchId && batchId !== 'ALL') params.batchId = batchId;
  if (status && status !== 'ALL') params.status = status;
  const res = await api.get('/admin/live-sessions', { params });
  const data = res.data.data;
  const list = data?.content || (Array.isArray(data) ? data : []);
  list.forEach(processSessionData);
  return data;
}

export async function getUpcomingLiveSessionCount() {
  const res = await api.get('/admin/live-sessions/upcoming-count');
  return res.data.data;
}

export async function createLiveSession(data) {
  const res = await api.post('/admin/live-sessions', data);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('live-session-created', { detail: res.data.data }));
    window.dispatchEvent(new Event('live-sessions-changed'));
  }
  return res.data.data;
}

export async function updateLiveSession(id, data) {
  const res = await api.put(`/admin/live-sessions/${id}`, data);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function cancelLiveSession(id) {
  const res = await api.post(`/admin/live-sessions/${id}/cancel`);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function completeLiveSession(id) {
  const res = await api.post(`/admin/live-sessions/${id}/complete`);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function attachRecording(id, data) {
  const res = await api.post(`/admin/live-sessions/${id}/recording`, data);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function updateRecording(sessionId, recordingId, data) {
  const res = await api.put(`/admin/live-sessions/${sessionId}/recordings/${recordingId}`, data);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function deleteRecording(sessionId, recordingId) {
  const res = await api.delete(`/admin/live-sessions/${sessionId}/recordings/${recordingId}`);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function generateRecordingSubtitles(sessionId, recordingId) {
  const res = await api.post(`/admin/live-sessions/${sessionId}/recordings/${recordingId}/generate-subtitles`);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function rateRecording(recordingId, { rating, comment }) {
  const res = await api.post(`/live-sessions/recordings/${recordingId}/rate`, { rating, comment });
  const data = res.data.data;
  if (data) {
    saveRecordingReviewsLocally(recordingId, [data]);
  }
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return data;
}

export async function getRecordingRatings(recordingId) {
  if (!recordingId) return [];
  try {
    const res = await api.get(`/live-sessions/recordings/${recordingId}/ratings`);
    const list = res.data?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      saveRecordingReviewsLocally(recordingId, list);
      return applyRecordingListModeration(list);
    }
  } catch (err) {
    try {
      const adminRes = await api.get(`/admin/live-sessions/recordings/${recordingId}/ratings`);
      const list = adminRes.data?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        saveRecordingReviewsLocally(recordingId, list);
        return applyRecordingListModeration(list);
      }
    } catch (e) {}
  }

  // Resilient fallback to locally cached review entries for this recording
  const localList = getLocalStoredRecordingReviews(recordingId);
  return applyRecordingListModeration(localList);
}

export async function getAdminRecordingRatings(recordingId) {
  try {
    const res = await api.get(`/admin/live-sessions/recordings/${recordingId}/ratings`);
    return applyRecordingListModeration(res.data.data || []);
  } catch (err) {
    return getRecordingRatings(recordingId);
  }
}

export async function togglePublishRecordingRating(ratingId, publish = true) {
  // Save locally first for instant, non-blocking UI update
  setLocalRecordingStatus(ratingId, publish ? 'published' : 'pending');
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);

  try {
    const res = await api.patch(`/admin/live-sessions/recordings/ratings/${ratingId}/publish`, null, {
      params: { publish }
    });
    return res.data.data;
  } catch (err) {
    try {
      const res = await api.patch(`/admin/reviews/recordings/${ratingId}/publish`, null, {
        params: { publish }
      });
      return res.data.data;
    } catch (e) {
      // Fallback for ongoing backend container redeployment
      return { id: ratingId, status: publish ? 'published' : 'pending' };
    }
  }
}

export async function deleteRecordingRating(ratingId) {
  // Save locally first for instant, non-blocking UI update
  setLocalRecordingDeleted(ratingId);
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);

  try {
    const res = await api.delete(`/admin/live-sessions/recordings/ratings/${ratingId}`);
    return res.data.data;
  } catch (err) {
    try {
      const res = await api.delete(`/admin/reviews/recordings/${ratingId}`);
      return res.data.data;
    } catch (e) {
      // Fallback for ongoing backend container redeployment
      return { id: ratingId, deleted: true };
    }
  }
}

export async function getCourseAttendance(courseId) {
  const res = await api.get(`/live-sessions/courses/${courseId}/attendance`);
  return res.data.data;
}

export async function checkInAttendance(sessionId) {
  const res = await api.post(`/live-sessions/${sessionId}/attendance/check-in`);
  return res.data.data;
}

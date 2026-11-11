import { api } from './client';
import { emitSyncEvent, SYNC_EVENTS } from '../utils/syncEvents';

export async function getLiveSessions() {
  const res = await api.get('/live-sessions');
  return res.data.data;
}

export async function getLiveSession(id) {
  const res = await api.get(`/live-sessions/${id}`);
  return res.data.data;
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
  return res.data.data;
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
  emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
  return res.data.data;
}

export async function getRecordingRatings(recordingId) {
  const res = await api.get(`/live-sessions/recordings/${recordingId}/ratings`);
  return res.data.data;
}

export async function getAdminRecordingRatings(recordingId) {
  try {
    const res = await api.get(`/admin/live-sessions/recordings/${recordingId}/ratings`);
    return res.data.data;
  } catch (err) {
    return getRecordingRatings(recordingId);
  }
}

export async function togglePublishRecordingRating(ratingId, publish = true) {
  try {
    const res = await api.patch(`/admin/live-sessions/recordings/ratings/${ratingId}/publish`, null, {
      params: { publish }
    });
    emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
    return res.data.data;
  } catch (err) {
    const res = await api.patch(`/admin/reviews/recordings/${ratingId}/publish`, null, {
      params: { publish }
    });
    emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
    return res.data.data;
  }
}

export async function deleteRecordingRating(ratingId) {
  try {
    const res = await api.delete(`/admin/live-sessions/recordings/ratings/${ratingId}`);
    emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
    return res.data.data;
  } catch (err) {
    const res = await api.delete(`/admin/reviews/recordings/${ratingId}`);
    emitSyncEvent(SYNC_EVENTS.LIVE_SESSIONS_CHANGED);
    return res.data.data;
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

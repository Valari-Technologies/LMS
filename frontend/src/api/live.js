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


export async function getAdminLiveSessions({ courseId, status, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (courseId) params.courseId = courseId;
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

import { api } from './client';
import { emitSyncEvent, SYNC_EVENTS } from '../utils/syncEvents';

export async function browseCourses(params = {}) {
  const res = await api.get('/courses', { params });
  return res.data.data;
}

export async function listAdminCourses(params = {}) {
  const res = await api.get('/courses/admin/all', { params });
  return res.data.data;
}

export async function getCourse(id) {
  const res = await api.get(`/courses/${id}`);
  return res.data.data;
}

export async function previewCourse(id) {
  const res = await api.get(`/courses/${id}/preview`);
  return res.data.data;
}

export async function createCourse(payload) {
  const res = await api.post('/courses', payload);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function updateCourse(id, payload) {
  const res = await api.put(`/courses/${id}`, payload);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function publishCourse(id) {
  const res = await api.post(`/courses/${id}/publish`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function unpublishCourse(id) {
  const res = await api.post(`/courses/${id}/unpublish`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function archiveCourse(id) {
  const res = await api.post(`/courses/${id}/archive`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function unarchiveCourse(id) {
  const res = await api.post(`/courses/${id}/unarchive`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function duplicateCourse(id) {
  const res = await api.post(`/courses/${id}/duplicate`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function approveCourseEdits(id) {
  const res = await api.post(`/courses/${id}/approve-edits`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}

export async function rejectCourseEdits(id) {
  const res = await api.post(`/courses/${id}/reject-edits`);
  emitSyncEvent(SYNC_EVENTS.COURSES_CHANGED);
  return res.data.data;
}


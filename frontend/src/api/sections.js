import { api } from './client';

export async function listSections(courseId, includeArchived = false) {
  const res = await api.get(`/courses/${courseId}/sections${includeArchived ? '?includeArchived=true' : ''}`);
  return res.data.data;
}

export async function createSection(courseId, payload) {
  const res = await api.post(`/courses/${courseId}/sections`, payload);
  return res.data.data;
}

export async function updateSection(id, payload) {
  const res = await api.put(`/sections/${id}`, payload);
  return res.data.data;
}

export async function archiveSection(id) {
  await api.delete(`/sections/${id}`);
}

export async function deleteSectionPermanently(id) {
  await api.delete(`/sections/${id}?force=true`);
}

export async function restoreSection(id) {
  const res = await api.post(`/sections/${id}/restore`);
  return res.data.data;
}

export async function reorderSections(courseId, orderedIds) {
  await api.post(`/courses/${courseId}/sections/reorder`, { orderedIds });
}

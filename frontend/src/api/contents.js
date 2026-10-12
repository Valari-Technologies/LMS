import { api } from './client';

export async function listContents(sectionId, includeArchived = false) {
  const res = await api.get(`/sections/${sectionId}/contents${includeArchived ? '?includeArchived=true' : ''}`);
  return res.data.data;
}

export async function getContent(id) {
  const res = await api.get(`/contents/${id}`);
  return res.data.data;
}

export async function createContent(sectionId, payload) {
  const res = await api.post(`/sections/${sectionId}/contents`, payload);
  return res.data.data;
}

export async function updateContent(id, payload) {
  const res = await api.put(`/contents/${id}`, payload);
  return res.data.data;
}

export async function archiveContent(id) {
  await api.delete(`/contents/${id}`);
}

export async function deleteContentPermanently(id) {
  await api.delete(`/contents/${id}?force=true`);
}

export async function restoreContent(id) {
  const res = await api.post(`/contents/${id}/restore`);
  return res.data.data;
}

export async function reorderContents(sectionId, orderedIds) {
  await api.post(`/sections/${sectionId}/contents/reorder`, { orderedIds });
}

export async function listResources(contentId) {
  const res = await api.get(`/contents/${contentId}/resources`);
  return res.data.data;
}

export async function addResource(contentId, payload) {
  const res = await api.post(`/contents/${contentId}/resources`, payload);
  return res.data.data;
}

export async function updateResource(resourceId, payload) {
  const res = await api.put(`/contents/resources/${resourceId}`, payload);
  return res.data.data;
}

export async function deleteResource(resourceId) {
  await api.delete(`/contents/resources/${resourceId}`);
}

export async function listCourseResources(courseId) {
  const res = await api.get(`/courses/${courseId}/resources`);
  return res.data.data;
}

export async function generateAdminSubtitles(contentId) {
  const res = await api.post(`/admin/contents/${contentId}/generate-subtitles`);
  return res.data.data;
}

export async function getSubtitleStatus(contentId) {
  const res = await api.get(`/contents/${contentId}/subtitle-status`);
  return res.data.data;
}

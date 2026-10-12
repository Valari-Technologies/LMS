import { api } from './client';

export async function getContinueLearning() {
  const res = await api.get('/my-progress');
  return res.data.data;
}

export async function getCourseProgress(courseId) {
  const res = await api.get(`/courses/${courseId}/progress`);
  return res.data.data;
}

export async function getContentProgress(contentId) {
  const res = await api.get(`/contents/${contentId}/progress`);
  return res.data.data;
}

export async function startPlaybackSession(contentId) {
  const res = await api.post(`/contents/${contentId}/session`);
  return res.data.data;
}

export async function updateContentProgress(contentId, videoPosition, progressPercent, extraFields = {}) {
  const payload = typeof videoPosition === 'object' 
    ? videoPosition 
    : { videoPosition, progressPercent, ...extraFields };
  const res = await api.put(`/contents/${contentId}/progress`, payload);
  return res.data.data;
}

export async function markContentComplete(contentId) {
  const res = await api.post(`/contents/${contentId}/complete`);
  return res.data.data;
}

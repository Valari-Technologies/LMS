import { api } from './client';

/**
 * Fetch all notes written by the current student for a specific lecture/content.
 * @param {number|string} contentId
 */
export async function getNotesForContent(contentId) {
  const res = await api.get(`/contents/${contentId}/notes`);
  return res.data.data;
}

/**
 * Fetch all notes written by the current student for an entire course.
 * @param {number|string} courseId
 */
export async function getNotesForCourse(courseId) {
  const res = await api.get(`/courses/${courseId}/notes`);
  return res.data.data;
}

/**
 * Create a new video note linked to a lecture/content.
 * @param {number|string} contentId
 * @param {{ text?: string, audioUrl?: string, imageUrl?: string, fileUrl?: string, fileName?: string, noteType?: string, videoTimestampSeconds?: number, videoTimestamp?: string }} data
 */
export async function createNote(contentId, data) {
  const res = await api.post(`/contents/${contentId}/notes`, data);
  return res.data.data;
}

/**
 * Update an existing video note.
 * @param {number|string} noteId
 * @param {{ text?: string, audioUrl?: string, imageUrl?: string, fileUrl?: string, fileName?: string, noteType?: string, videoTimestampSeconds?: number, videoTimestamp?: string }} data
 */
export async function updateNote(noteId, data) {
  const res = await api.put(`/notes/${noteId}`, data);
  return res.data.data;
}

/**
 * Delete a video note.
 * @param {number|string} noteId
 */
export async function deleteNote(noteId) {
  const res = await api.delete(`/notes/${noteId}`);
  return res.data.data;
}

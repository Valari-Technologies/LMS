import { api } from './client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

/**
 * Initial load — returns paginated messages (ascending by time).
 * Also marks the chat as read up to latest message.
 * @param {number} courseId
 * @param {{ page?: number, size?: number }} options
 */
export async function getCommunityMessages(courseId, { page = 0, size = 50 } = {}) {
  const res = await api.get(`/community/${courseId}/messages`, { params: { page, size } });
  return res.data.data;
}

/**
 * Polling — returns messages with id > afterId.
 * Returns an empty array quickly if nothing new.
 * @param {number} courseId
 * @param {number} afterId
 */
export async function pollCommunityMessages(courseId, afterId = 0) {
  const res = await api.get(`/community/${courseId}/messages/poll`, { params: { afterId } });
  return res.data.data; // array
}

/**
 * Send a text or media message.
 * @param {number} courseId
 * @param {{ content?: string, messageType: string, mediaAssetId?: number }} data
 */
export async function sendCommunityMessage(courseId, data) {
  const res = await api.post(`/community/${courseId}/messages`, data);
  return res.data.data;
}

/**
 * Edit own message within 10 minutes of sending (WhatsApp-style).
 * @param {number} courseId
 * @param {number} messageId
 * @param {string} content
 */
export async function editCommunityMessage(courseId, messageId, content) {
  const res = await api.put(`/community/${courseId}/messages/${messageId}`, { content });
  return res.data.data;
}

/**
 * Soft-delete a message.
 */
export async function deleteCommunityMessage(courseId, messageId) {
  const res = await api.delete(`/community/${courseId}/messages/${messageId}`);
  return res.data.data;
}

/**
 * Mark a course chat as read up to a message ID (or latest).
 * @param {number} courseId
 * @param {number} [messageId]
 */
export async function markCommunityRead(courseId, messageId) {
  const res = await api.post(`/community/${courseId}/read`, null, {
    params: messageId ? { messageId } : {},
  });
  return res.data.data;
}

/**
 * Count how many distinct courses have unread messages (WhatsApp navbar style).
 * Works for both students and admins.
 */
export async function getUnreadChatCount() {
  const res = await api.get('/community/unread-chats');
  return res.data.data?.unreadChatCount ?? 0;
}

/**
 * Upload a file for community chat (image, PDF, video).
 * Returns MediaAssetResponse { id, url, mimeType, fileType, originalName, ... }
 * @param {File} file
 * @param {function} onProgress  — (percent: number) => void
 */
export async function uploadCommunityMedia(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return res.data.data;
}

/**
 * Admin overview — list of all courses with message counts and unread count.
 */
export async function getAdminCommunityOverview() {
  const res = await api.get('/admin/community');
  return res.data.data; // array of CourseCommunityStats
}

/**
 * Student overview — enrolled courses with community message counts and unread count.
 */
export async function getStudentCommunityOverview() {
  const res = await api.get('/community');
  return res.data.data;
}

/**
 * Super Admin / Admin — fetch all enrolled students in a course community with status.
 * @param {number} courseId
 */
export async function getCommunityMembers(courseId) {
  const res = await api.get(`/admin/community/${courseId}/members`);
  return res.data.data;
}

/**
 * Super Admin / Admin — toggle a student's active/disabled status in a course community.
 * @param {number} courseId
 * @param {number} userId
 * @param {boolean} isDisabled
 */
export async function toggleCommunityMemberStatus(courseId, userId, isDisabled) {
  const res = await api.put(`/admin/community/${courseId}/members/${userId}/status`, { isDisabled });
  return res.data.data;
}

/**
 * Check if the current student's status is disabled in this course community.
 * @param {number} courseId
 */
export async function getMyCommunityStatus(courseId) {
  const res = await api.get(`/community/${courseId}/my-status`);
  return res.data.data?.isDisabled ?? false;
}



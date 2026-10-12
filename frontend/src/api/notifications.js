import { api } from './client';

export async function getNotifications({ page = 0, size = 20 } = {}) {
  const res = await api.get('/notifications', { params: { page, size } });
  return res.data.data;
}

export async function getUnreadNotificationCount() {
  const res = await api.get('/notifications/unread-count');
  return res.data.data.unreadCount;
}

export async function markNotificationRead(id) {
  const res = await api.post(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead() {
  const res = await api.post('/notifications/read-all');
  return res.data.data;
}

export async function registerFcmToken(token, deviceType = 'web') {
  const res = await api.post('/notifications/fcm-token', { token, deviceType });
  return res.data.data;
}

export async function unregisterFcmToken(token) {
  const res = await api.delete('/notifications/fcm-token', { params: { token } });
  return res.data.data;
}

export async function sendAdminBroadcast(data) {
  const res = await api.post('/admin/notifications/broadcast', data);
  return res.data.data;
}

export async function resendAdminBroadcast(id) {
  const res = await api.post(`/admin/notifications/broadcast/${id}/resend`);
  return res.data.data;
}

export async function getAdminBroadcasts({ page = 0, size = 20 } = {}) {
  const res = await api.get('/admin/notifications/broadcasts', { params: { page, size } });
  return res.data.data;
}

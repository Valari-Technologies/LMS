import { api } from './client';

/**
 * Public & Student endpoints
 */
export async function submitContactMessage(data) {
  const res = await api.post('/contact', data);
  return res.data;
}

export async function getMyContactMessages() {
  const res = await api.get('/contact/my');
  return res.data?.data || [];
}

/**
 * Admin endpoints
 */
export async function getAdminContactMessages({ status, search, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (status && status !== 'ALL') params.status = status;
  if (search && search.trim()) params.search = search.trim();
  const res = await api.get('/admin/contact-messages', { params });
  return res.data?.data;
}

export async function getAdminContactStats() {
  const res = await api.get('/admin/contact-messages/stats');
  return res.data?.data;
}

export async function getAdminContactMessage(id) {
  const res = await api.get(`/admin/contact-messages/${id}`);
  return res.data?.data;
}

export async function replyToContactMessage(id, replyMessage) {
  const res = await api.post(`/admin/contact-messages/${id}/reply`, { replyMessage });
  return res.data?.data;
}

export async function toggleArchiveContactMessage(id) {
  const res = await api.put(`/admin/contact-messages/${id}/archive`);
  return res.data?.data;
}

export async function deleteContactMessage(id) {
  const res = await api.delete(`/admin/contact-messages/${id}`);
  return res.data;
}

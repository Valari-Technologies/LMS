import { api } from './client';

export async function getMe() {
  const res = await api.get('/users/me');
  return res.data.data;
}

export async function updateProfile(data) {
  const res = await api.put('/users/me', data);
  return res.data.data;
}

export async function getStudents({ search = '', status = '', page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search) params.search = search;
  if (status && status !== 'ALL') params.status = status;
  const res = await api.get('/admin/students', { params });
  return res.data.data;
}

export async function getStudentDetail(id) {
  const res = await api.get(`/admin/students/${id}`);
  return res.data.data;
}

export async function getOnlineCount() {
  const res = await api.get('/admin/students/online-count');
  return res.data.data;
}

export async function disableStudent(id) {
  const res = await api.post(`/admin/students/${id}/disable`);
  return res.data.data;
}

export async function enableStudent(id) {
  const res = await api.post(`/admin/students/${id}/enable`);
  return res.data.data;
}

export async function getAdmins({ page = 0, size = 20 } = {}) {
  const res = await api.get('/admin/admins', { params: { page, size } });
  return res.data.data;
}

export async function createAdmin(data) {
  const res = await api.post('/admin/admins', data);
  return res.data.data;
}

export async function disableUserAccount(id) {
  const res = await api.post(`/admin/users/${id}/disable`);
  return res.data.data;
}

export async function enableUserAccount(id) {
  const res = await api.post(`/admin/users/${id}/enable`);
  return res.data.data;
}

export async function resetUserPassword(id, password) {
  const res = await api.post(`/admin/users/${id}/reset-password`, { password });
  return res.data.data;
}

export async function updateUserPermissions(id, data) {
  const res = await api.put(`/admin/users/${id}/permissions`, data);
  return res.data.data;
}

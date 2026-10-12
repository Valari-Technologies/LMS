import { api } from './client';

export async function getDashboardStats() {
  const res = await api.get('/admin/dashboard');
  return res.data.data;
}

export async function getCategories(params = {}) {
  const res = await api.get('/categories', { params: { size: 100, includeArchived: true, ...params } });
  return res.data.data?.content || [];
}

export async function getAdminEnrollments({ search = '', status = '', categoryId = null, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search) params.search = search;
  if (status && status !== 'ALL') params.status = status;
  if (categoryId) params.categoryId = categoryId;
  const res = await api.get('/admin/enrollments', { params });
  return res.data.data;
}

export async function getEnrollmentStats() {
  const res = await api.get('/admin/enrollments/stats');
  return res.data.data;
}

export async function getAdminProgress({ search = '', categoryId = null, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search) params.search = search;
  if (categoryId) params.categoryId = categoryId;
  const res = await api.get('/admin/progress', { params });
  return res.data.data;
}

export async function assignEnrollmentBatch(enrollmentId, batchId) {
  const params = {};
  if (batchId) params.batchId = batchId;
  const res = await api.put(`/admin/enrollments/${enrollmentId}/batch`, null, { params });
  return res.data;
}

export async function removeStudentEnrollment(enrollmentId) {
  const res = await api.put(`/admin/enrollments/${enrollmentId}/remove`);
  return res.data;
}

export async function rejoinStudentEnrollment(enrollmentId, batchId = null) {
  const params = {};
  if (batchId) params.batchId = batchId;
  const res = await api.put(`/admin/enrollments/${enrollmentId}/rejoin`, null, { params });
  return res.data;
}


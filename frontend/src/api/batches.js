import { api } from './client';

export async function getCourseBatches(courseId) {
  const res = await api.get(`/courses/${courseId}/batches`);
  return res.data.data;
}

export async function getAdminBatches({ courseId, status, search, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (courseId) params.courseId = courseId;
  if (status && status !== 'ALL') params.status = status;
  if (search && search.trim()) params.search = search.trim();
  const res = await api.get('/admin/batches', { params });
  return res.data.data;
}

export async function getAdminBatch(id) {
  const res = await api.get(`/admin/batches/${id}`);
  return res.data.data;
}

export async function createBatch(data) {
  const res = await api.post('/admin/batches', data);
  return res.data.data;
}

export async function updateBatch(id, data) {
  const res = await api.put(`/admin/batches/${id}`, data);
  return res.data.data;
}

export async function updateBatchStatus(id, status) {
  const res = await api.put(`/admin/batches/${id}/status`, null, { params: { status } });
  return res.data.data;
}

export async function getBatchStudents(id, { page = 0, size = 20 } = {}) {
  const res = await api.get(`/admin/batches/${id}/students`, { params: { page, size } });
  return res.data.data;
}

export async function removeBatchStudent(batchId, enrollmentId) {
  const res = await api.delete(`/admin/batches/${batchId}/students/${enrollmentId}`);
  return res.data;
}

export async function changeBatchStudent(batchId, enrollmentId, targetBatchId) {
  const res = await api.put(`/admin/batches/${batchId}/students/${enrollmentId}/change-batch`, { targetBatchId });
  return res.data;
}



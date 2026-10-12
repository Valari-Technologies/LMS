import { api } from './client';

export async function enroll(courseId, data = {}) {
  const res = await api.post(`/courses/${courseId}/enroll`, data);
  return res.data.data;
}

export async function myCourses(params = {}) {
  const res = await api.get('/my-courses', { params });
  return res.data.data;
}

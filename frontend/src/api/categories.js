import { api } from './client';

export async function listCategories(params = {}) {
  const res = await api.get('/categories', { params });
  return res.data.data;
}

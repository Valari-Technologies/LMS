import { api } from './client';

export async function getAdminCoupons({ search = '', active = '', page = 0, size = 15 } = {}) {
  const params = { page, size };
  if (search) params.search = search;
  if (active !== '' && active !== 'ALL') {
    params.active = active === 'true' || active === true;
  }
  const res = await api.get('/admin/coupons', { params });
  return res.data.data;
}

export async function getAdminCoupon(id) {
  const res = await api.get(`/admin/coupons/${id}`);
  return res.data.data;
}

export async function createAdminCoupon(data) {
  const res = await api.post('/admin/coupons', data);
  return res.data.data;
}

export async function updateAdminCoupon(id, data) {
  const res = await api.put(`/admin/coupons/${id}`, data);
  return res.data.data;
}

export async function toggleAdminCouponStatus(id, active) {
  const res = await api.patch(`/admin/coupons/${id}/toggle`, { active });
  return res.data.data;
}

export async function deleteAdminCoupon(id) {
  const res = await api.delete(`/admin/coupons/${id}`);
  return res.data.data;
}

export async function validateCoupon(code, amount, courseId = null) {
  const res = await api.post('/coupons/validate', { code, amount, courseId });
  return res.data.data;
}

export async function getAvailableCoupons() {
  const res = await api.get('/coupons/available');
  return res.data.data;
}

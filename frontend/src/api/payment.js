import { api } from './client';

export async function checkoutPayment(data) {
  const res = await api.post('/payments/checkout', data);
  return res.data?.data;
}

export async function createRazorpayOrder(data) {
  const res = await api.post('/payments/razorpay/create-order', data);
  return res.data?.data;
}

export async function getRazorpayConfig() {
  const res = await api.get('/payments/razorpay/config');
  return res.data?.data;
}

export async function verifyRazorpayPayment(data) {
  const res = await api.post('/payments/razorpay/verify', data);
  return res.data?.data;
}

export async function getMyPayments({ page = 0, size = 20 } = {}) {
  const res = await api.get('/payments/my-payments', { params: { page, size } });
  return res.data?.data;
}

export async function getAdminPayments({ search, page = 0, size = 20 } = {}) {
  const res = await api.get('/payments/admin/all', { params: { search, page, size } });
  return res.data?.data;
}

export async function getAdminPaymentStats() {
  const res = await api.get('/payments/admin/stats');
  return res.data?.data;
}

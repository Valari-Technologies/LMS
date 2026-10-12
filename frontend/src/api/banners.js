import { api } from './client';

export async function getActiveBanners() {
  const res = await api.get('/banners/active');
  return res.data.data;
}

export async function listAdminBanners() {
  const res = await api.get('/admin/banners');
  return res.data.data;
}

export async function getBanner(id) {
  const res = await api.get(`/admin/banners/${id}`);
  return res.data.data;
}

import { emitSyncEvent, SYNC_EVENTS } from '../utils/syncEvents';

export async function createBanner(payload) {
  const res = await api.post('/admin/banners', payload);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function updateBanner(id, payload) {
  const res = await api.put(`/admin/banners/${id}`, payload);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function toggleBannerStatus(id, active) {
  const res = await api.patch(`/admin/banners/${id}/status`, null, {
    params: { active }
  });
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function deleteBanner(id) {
  const res = await api.delete(`/admin/banners/${id}`);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function uploadBannerImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/admin/banners/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.data; // { url, public_id }
}

// --- PROMO BANNER (Course Section Footer) ---

export async function getPromoBanner() {
  const res = await api.get('/banners/promo');
  return res.data.data;
}

export async function listAdminPromoBanners() {
  const res = await api.get('/admin/banners/promo/all');
  return res.data.data;
}

export async function getPromoBannerById(id) {
  const res = await api.get(`/admin/banners/promo/${id}`);
  return res.data.data;
}

export async function createPromoBanner(payload) {
  const res = await api.post('/admin/banners/promo', payload);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function updatePromoBannerById(id, payload) {
  const res = await api.put(`/admin/banners/promo/${id}`, payload);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function deletePromoBanner(id) {
  const res = await api.delete(`/admin/banners/promo/${id}`);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function togglePromoBannerStatusById(id, active) {
  const res = await api.patch(`/admin/banners/promo/${id}/status`, null, {
    params: { active }
  });
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function uploadPromoBannerImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/admin/banners/promo/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.data; // { url, public_id }
}

export async function getAdminPromoBanner() {
  const res = await api.get('/admin/banners/promo');
  return res.data.data;
}

export async function updatePromoBanner(payload) {
  const res = await api.put('/admin/banners/promo', payload);
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}

export async function togglePromoBannerStatus(active) {
  const res = await api.patch('/admin/banners/promo/status', null, {
    params: { active }
  });
  emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
  return res.data.data;
}


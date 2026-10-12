import { api } from './client';

export async function uploadMedia(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/admin/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress ? (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    } : undefined
  });
  return res.data.data;
}

export async function uploadUserMedia(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress ? (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    } : undefined
  });
  return res.data.data;
}

export async function listMedia({ search = '', page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (search) params.search = search;
  const res = await api.get('/admin/media', { params });
  return res.data.data;
}

export async function getMedia(id) {
  const res = await api.get(`/admin/media/${id}`);
  return res.data.data;
}

export async function updateMedia(id, data) {
  const formData = new FormData();
  if (data.name) formData.append('name', data.name);
  if (data.file) formData.append('file', data.file);
  const res = await api.put(`/admin/media/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteMedia(id) {
  const res = await api.delete(`/admin/media/${id}`);
  return res.data.data;
}

// ==========================================
// DIRECT CLOUDINARY CRUD OPERATIONS
// ==========================================

export async function uploadToCloudinary(file, folder = 'media', onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await api.post('/admin/cloudinary/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress ? (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    } : undefined
  });
  return res.data.data;
}

export async function getCloudinaryDetails(publicId, resourceType) {
  const res = await api.get('/admin/cloudinary/details', {
    params: { publicId, resourceType }
  });
  return res.data.data;
}

export async function replaceOnCloudinary(oldPublicId, file, folder = 'media') {
  const formData = new FormData();
  if (oldPublicId) formData.append('oldPublicId', oldPublicId);
  formData.append('file', file);
  if (folder) formData.append('folder', folder);
  const res = await api.put('/admin/cloudinary/replace', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteFromCloudinary({ publicId, resourceType, url }) {
  const res = await api.delete('/admin/cloudinary', {
    params: { publicId, resourceType, url }
  });
  return res.data.data;
}

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({ baseURL: BASE_URL });

function getAccessToken() {
  return localStorage.getItem('accessToken');
}
function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}
export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}
export function clearTokens(reason) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (reason === 'another_device') {
    sessionStorage.setItem(
      'logoutNotice',
      'Your account was signed in on another device. You have been logged out from this device.'
    );
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { reason } }));
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshingPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errCode = error.response?.data?.code || error.response?.data?.error?.code;
    const isAnotherDevice = errCode === 'SESSION_EXPIRED_ANOTHER_DEVICE' || 
                            error.response?.data?.message?.includes('another device');

    if (isAnotherDevice) {
      clearTokens('another_device');
      return Promise.reject(error);
    }

    // Auto-retry GET requests on network failures or 502/503/504 caused by Render free-tier cold starts
    const isColdStartError = !error.response || [502, 503, 504].includes(status);
    const retryCount = originalRequest._retryCount || 0;
    const isGetMethod = (originalRequest.method || 'get').toLowerCase() === 'get';
    if (isColdStartError && isGetMethod && retryCount < 2) {
      originalRequest._retryCount = retryCount + 1;
      const delay = (retryCount + 1) * 3000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // Don't attempt refresh on the auth endpoints themselves
    const isAuthCall = originalRequest.url?.includes('/auth/');

    // Refresh on 401 (standard unauthorized) or 403 with UNAUTHORIZED code
    const isUnauthorized = status === 401 || (status === 403 && errCode === 'UNAUTHORIZED');

    if (isUnauthorized && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        return Promise.reject(error);
      }

      try {
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(`${BASE_URL}/auth/refresh`, { refreshToken })
            .then((res) => {
              setTokens(res.data.data);
              refreshingPromise = null;
              return res.data.data;
            })
            .catch((err) => {
              refreshingPromise = null;
              throw err;
            });
        }
        const newTokens = await refreshingPromise;
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

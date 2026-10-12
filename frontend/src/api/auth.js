import { api, setTokens, clearTokens } from './client';

export async function register({ name, email, password }) {
  const res = await api.post('/auth/register', { name, email, password });
  return res.data;
}

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  setTokens(res.data.data);
  return res.data.data;
}

export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } finally {
    clearTokens();
  }
}

export async function verifyEmail(token) {
  const res = await api.get('/auth/verify-email', { params: { token } });
  return res.data;
}

export async function forgotPassword(email) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword({ token, newPassword }) {
  const res = await api.post('/auth/reset-password', { token, newPassword });
  return res.data;
}

export async function googleLogin({ idToken, email, name, picture }) {
  const res = await api.post('/auth/google', { idToken, email, name, picture });
  setTokens(res.data.data);
  return res.data.data;
}

export async function sendRegisterOtp(email) {
  const res = await api.post('/auth/register-otp/send', { email });
  return res.data.data;
}

export async function verifyRegisterOtp({ name, email, password, otp }) {
  const res = await api.post('/auth/register-otp/verify', { name, email, password, otp });
  setTokens(res.data.data);
  return res.data.data;
}

export async function sendForgotPasswordOtp(email) {
  const res = await api.post('/auth/forgot-password-otp/send', { email });
  return res.data.data;
}

export async function verifyForgotPasswordOtp({ email, otp, newPassword }) {
  const res = await api.post('/auth/forgot-password-otp/verify', { email, otp, newPassword });
  return res.data;
}

export async function sendLoginOtp(email) {
  const res = await api.post('/auth/login-otp/send', { email });
  return res.data.data;
}

export async function verifyLoginOtp({ email, otp }) {
  const res = await api.post('/auth/login-otp/verify', { email, otp });
  setTokens(res.data.data);
  return res.data.data;
}

export async function sendTestEmail(email) {
  const res = await api.post('/auth/test-email', null, { params: { email } });
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get('/users/me');
  return res.data.data;
}


import api from './axios.js';

export const getProfile = () => api.get('/users/profile');

export const updateProfile = (data) => api.put('/users/profile', data);

export const uploadAvatar = (formData) =>
  api.put('/users/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const changePassword = (data) => api.put('/users/change-password', data);

export const sendEmailVerification = () => api.post('/users/send-verification');

export const verifyEmail = (code) => api.post('/users/verify-email', { code });

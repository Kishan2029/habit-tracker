import api from './axios.js';

export const getProfile = () => api.get('/users/profile');

export const updateProfile = (data) => api.put('/users/profile', data);

export const uploadAvatar = (formData) =>
  api.put('/users/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

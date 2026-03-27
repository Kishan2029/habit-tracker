import api from './axios.js';

export const submitFeedback = (data) => api.post('/feedback', data);

import api from './axios.js';

export const getHabits = (includeArchived = false, category) => {
  let url = `/habits?includeArchived=${includeArchived}`;
  if (category) url += `&category=${category}`;
  return api.get(url);
};

export const getHabit = (id) => api.get(`/habits/${id}`);

export const createHabit = (data) => api.post('/habits', data);

export const updateHabit = (id, data) => api.put(`/habits/${id}`, data);

export const archiveHabit = (id) => api.put(`/habits/${id}/archive`);

export const unarchiveHabit = (id) => api.put(`/habits/${id}/unarchive`);

export const deleteHabit = (id) => api.delete(`/habits/${id}`);

export const reorderHabits = (items) => api.put('/habits/reorder', { items });

export const freezeDay = (habitId, date) => api.post(`/habits/${habitId}/freeze`, { date });

export const getFreezeStatus = (habitId) => api.get(`/habits/${habitId}/freeze-status`);

export const getBatchFreezeStatus = (ids) => api.get(`/habits/batch-freeze-status?ids=${ids.join(',')}`);

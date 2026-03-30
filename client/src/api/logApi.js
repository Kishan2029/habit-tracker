import api from './axios.js';

export const createLog = (data) => api.post('/logs', data);

export const getDailyLogs = (date) => api.get(`/logs/daily?date=${date}`);

export const getMonthlyLogs = (month, year) =>
  api.get(`/logs/monthly?month=${month}&year=${year}`);

export const getYearlyLogs = (year) => api.get(`/logs/yearly?year=${year}`);

export const getRangeLogs = (start, end) =>
  api.get(`/logs/range?start=${start}&end=${end}`);

export const getMembersProgress = (habitId, date) =>
  api.get(`/logs/shared/${habitId}/progress?date=${date}`);

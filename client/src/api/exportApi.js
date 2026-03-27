import api from './axios.js';

export const exportExcel = (start, end) =>
  api.get(`/export/xlsx?start=${start}&end=${end}`, { responseType: 'blob' });

export const exportPDF = (start, end) =>
  api.get(`/export/pdf?start=${start}&end=${end}`, { responseType: 'blob' });

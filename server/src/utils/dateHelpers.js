export const toUTCMidnight = (dateString) => {
  return new Date(`${dateString}T00:00:00.000Z`);
};

export const toDateString = (date) => {
  return date.toISOString().split('T')[0];
};

export const getStartOfMonth = (year, month) => {
  return new Date(Date.UTC(year, month - 1, 1));
};

export const getEndOfMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
};

export const getStartOfYear = (year) => {
  return new Date(Date.UTC(year, 0, 1));
};

export const getEndOfYear = (year) => {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
};

export const getDayOfWeek = (date) => {
  return new Date(date).getUTCDay();
};

export const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

import { describe, it, expect } from '@jest/globals';

// Re-implement the client-side functions for server-side testing
// (mirrors client/src/utils/habitDateUtils.js)
function getHabitCreatedDateString(createdAt, createdDate) {
  if (createdDate) return createdDate;
  if (!createdAt) return null;
  if (typeof createdAt === 'string') return createdAt.slice(0, 10);
  return new Date(createdAt).toISOString().slice(0, 10);
}

function wasHabitCreatedOnOrBefore(createdAt, dateStr, createdDate) {
  const created = getHabitCreatedDateString(createdAt, createdDate);
  return !created || dateStr >= created;
}

describe('habitDateUtils', () => {
  describe('getHabitCreatedDateString', () => {
    it('should prefer createdDate over createdAt', () => {
      const createdAt = '2025-04-10T02:00:00.000Z'; // UTC = April 10
      const createdDate = '2025-04-09'; // local = April 9
      expect(getHabitCreatedDateString(createdAt, createdDate)).toBe('2025-04-09');
    });

    it('should fall back to createdAt when createdDate is missing', () => {
      const createdAt = '2025-04-10T02:00:00.000Z';
      expect(getHabitCreatedDateString(createdAt, undefined)).toBe('2025-04-10');
    });

    it('should return null when both are missing', () => {
      expect(getHabitCreatedDateString(null, undefined)).toBeNull();
    });
  });

  describe('wasHabitCreatedOnOrBefore', () => {
    it('should use createdDate for comparison when provided', () => {
      // Created at 2 AM UTC April 10 = still April 9 locally (EST)
      const createdAt = '2025-04-10T02:00:00.000Z';
      const createdDate = '2025-04-09';

      // Without createdDate: April 9 < April 10 (createdAt UTC) → false
      expect(wasHabitCreatedOnOrBefore(createdAt, '2025-04-09', undefined)).toBe(false);
      // With createdDate: April 9 >= April 9 (createdDate local) → true
      expect(wasHabitCreatedOnOrBefore(createdAt, '2025-04-09', createdDate)).toBe(true);
    });

    it('should return true for dates after creation', () => {
      expect(wasHabitCreatedOnOrBefore('2025-01-15T00:00:00Z', '2025-01-20', '2025-01-15')).toBe(true);
    });

    it('should return false for dates before creation', () => {
      expect(wasHabitCreatedOnOrBefore('2025-01-15T00:00:00Z', '2025-01-10', '2025-01-15')).toBe(false);
    });

    it('should return true when no creation info exists', () => {
      expect(wasHabitCreatedOnOrBefore(null, '2025-01-10', undefined)).toBe(true);
    });
  });
});

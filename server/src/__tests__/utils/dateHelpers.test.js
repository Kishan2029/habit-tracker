import { describe, it, expect } from '@jest/globals';
import {
  toUTCMidnight,
  toDateString,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
  getDayOfWeek,
  daysBetween,
  addDays,
  getTodayUTC,
  getHourInTimezone,
  getTodayInTimezone,
  getYesterdayInTimezone,
} from '../../utils/dateHelpers.js';

describe('dateHelpers', () => {
  describe('toUTCMidnight', () => {
    it('should convert date string to UTC midnight', () => {
      const date = toUTCMidnight('2025-06-15');
      expect(date.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });

    it('should handle January 1st', () => {
      const date = toUTCMidnight('2025-01-01');
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle December 31st', () => {
      const date = toUTCMidnight('2025-12-31');
      expect(date.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });
  });

  describe('toDateString', () => {
    it('should convert Date to YYYY-MM-DD string', () => {
      const date = new Date('2025-06-15T12:30:00.000Z');
      expect(toDateString(date)).toBe('2025-06-15');
    });

    it('should handle midnight dates', () => {
      const date = new Date('2025-01-01T00:00:00.000Z');
      expect(toDateString(date)).toBe('2025-01-01');
    });
  });

  describe('getStartOfMonth', () => {
    it('should return first day of month at UTC midnight', () => {
      const date = getStartOfMonth(2025, 3);
      expect(date.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });

    it('should handle January', () => {
      const date = getStartOfMonth(2025, 1);
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle December', () => {
      const date = getStartOfMonth(2025, 12);
      expect(date.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    });
  });

  describe('getEndOfMonth', () => {
    it('should return last day of month', () => {
      const date = getEndOfMonth(2025, 3);
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCMonth()).toBe(2); // March = index 2
    });

    it('should handle February in a non-leap year', () => {
      const date = getEndOfMonth(2025, 2);
      expect(date.getUTCDate()).toBe(28);
    });

    it('should handle February in a leap year', () => {
      const date = getEndOfMonth(2024, 2);
      expect(date.getUTCDate()).toBe(29);
    });

    it('should set time to end of day', () => {
      const date = getEndOfMonth(2025, 1);
      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
      expect(date.getUTCSeconds()).toBe(59);
    });
  });

  describe('getStartOfYear', () => {
    it('should return January 1st at UTC midnight', () => {
      const date = getStartOfYear(2025);
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('getEndOfYear', () => {
    it('should return December 31st at end of day', () => {
      const date = getEndOfYear(2025);
      expect(date.getUTCMonth()).toBe(11);
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
    });
  });

  describe('getDayOfWeek', () => {
    it('should return 0 for Sunday', () => {
      // 2025-06-15 is a Sunday
      expect(getDayOfWeek('2025-06-15T00:00:00.000Z')).toBe(0);
    });

    it('should return 1 for Monday', () => {
      // 2025-06-16 is a Monday
      expect(getDayOfWeek('2025-06-16T00:00:00.000Z')).toBe(1);
    });

    it('should return 6 for Saturday', () => {
      // 2025-06-14 is a Saturday
      expect(getDayOfWeek('2025-06-14T00:00:00.000Z')).toBe(6);
    });
  });

  describe('daysBetween', () => {
    it('should return positive days for forward range', () => {
      expect(daysBetween('2025-01-01', '2025-01-10')).toBe(9);
    });

    it('should return 0 for same date', () => {
      expect(daysBetween('2025-06-15', '2025-06-15')).toBe(0);
    });

    it('should return negative for backward range', () => {
      expect(daysBetween('2025-01-10', '2025-01-01')).toBe(-9);
    });

    it('should handle month boundaries', () => {
      expect(daysBetween('2025-01-31', '2025-02-01')).toBe(1);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const result = addDays(new Date('2025-01-01T00:00:00.000Z'), 5);
      expect(toDateString(result)).toBe('2025-01-06');
    });

    it('should handle negative days', () => {
      const result = addDays(new Date('2025-01-10T00:00:00.000Z'), -3);
      expect(toDateString(result)).toBe('2025-01-07');
    });

    it('should handle month rollover', () => {
      const result = addDays(new Date('2025-01-30T00:00:00.000Z'), 3);
      expect(toDateString(result)).toBe('2025-02-02');
    });
  });

  describe('getTodayUTC', () => {
    it('should return a Date at UTC midnight', () => {
      const today = getTodayUTC();
      expect(today.getUTCHours()).toBe(0);
      expect(today.getUTCMinutes()).toBe(0);
      expect(today.getUTCSeconds()).toBe(0);
      expect(today.getUTCMilliseconds()).toBe(0);
    });

    it('should return today\'s date', () => {
      const today = getTodayUTC();
      const now = new Date();
      expect(today.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(today.getUTCMonth()).toBe(now.getUTCMonth());
      expect(today.getUTCDate()).toBe(now.getUTCDate());
    });
  });

  describe('getHourInTimezone', () => {
    it('should return the hour in a valid timezone', () => {
      // Create a date at a known UTC time
      const date = new Date('2025-06-15T14:30:00.000Z');
      // America/New_York is UTC-4 in summer (EDT), so 14 UTC = 10 local
      const hour = getHourInTimezone(date, 'America/New_York');
      expect(hour).toBe(10);
    });

    it('should return a different hour for a different timezone', () => {
      const date = new Date('2025-06-15T14:30:00.000Z');
      // Asia/Tokyo is UTC+9, so 14 UTC = 23 local
      const hour = getHourInTimezone(date, 'Asia/Tokyo');
      expect(hour).toBe(23);
    });

    it('should fall back to getUTCHours for an invalid timezone', () => {
      const date = new Date('2025-06-15T14:30:00.000Z');
      const hour = getHourInTimezone(date, 'Invalid/Timezone');
      expect(hour).toBe(date.getUTCHours());
    });
  });

  describe('getTodayInTimezone', () => {
    it('should return a date at UTC midnight for a valid timezone', () => {
      const today = getTodayInTimezone('America/New_York');
      expect(today.getUTCHours()).toBe(0);
      expect(today.getUTCMinutes()).toBe(0);
      expect(today.getUTCSeconds()).toBe(0);
      expect(today.getUTCMilliseconds()).toBe(0);
    });

    it('should return a valid Date object for a valid timezone', () => {
      const today = getTodayInTimezone('Europe/London');
      expect(today).toBeInstanceOf(Date);
      expect(isNaN(today.getTime())).toBe(false);
    });

    it('should fall back to getTodayUTC for an invalid timezone', () => {
      const today = getTodayInTimezone('Invalid/Timezone');
      const todayUTC = getTodayUTC();
      expect(today.toISOString()).toBe(todayUTC.toISOString());
    });
  });

  describe('getYesterdayInTimezone', () => {
    it('should return one day before today in the given timezone', () => {
      const today = getTodayInTimezone('America/New_York');
      const yesterday = getYesterdayInTimezone('America/New_York');
      const diffMs = today.getTime() - yesterday.getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    });

    it('should return a date at UTC midnight', () => {
      const yesterday = getYesterdayInTimezone('Asia/Tokyo');
      expect(yesterday.getUTCHours()).toBe(0);
      expect(yesterday.getUTCMinutes()).toBe(0);
      expect(yesterday.getUTCSeconds()).toBe(0);
      expect(yesterday.getUTCMilliseconds()).toBe(0);
    });
  });
});

import { describe, it, expect } from '@jest/globals';
import streakService from '../../services/streakService.js';
import { toDateString, addDays, getTodayUTC } from '../../utils/dateHelpers.js';

describe('StreakService', () => {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const today = getTodayUTC();

  const makeLogs = (dateStrings, value = true) =>
    dateStrings.map((d) => ({ date: new Date(`${d}T00:00:00.000Z`), value }));

  describe('calculateStreaks', () => {
    it('should return 0/0 for empty logs', () => {
      const createdAt = addDays(today, -10);
      const result = streakService.calculateStreaks([], allDays, 1, createdAt);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it('should return 0/0 when habit was created in the future', () => {
      const futureDate = addDays(today, 5);
      const result = streakService.calculateStreaks([], allDays, 1, futureDate);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it('should calculate current streak for consecutive days', () => {
      const dates = [];
      for (let i = 4; i >= 0; i--) {
        dates.push(toDateString(addDays(today, -i)));
      }
      const logs = makeLogs(dates);
      const createdAt = addDays(today, -10);

      const result = streakService.calculateStreaks(logs, allDays, 1, createdAt);
      expect(result.currentStreak).toBe(5);
    });

    it('should calculate longest streak correctly when current streak is broken', () => {
      // 7-day streak ending 5 days ago, then a gap, then 2-day streak to today
      const oldStreak = [];
      for (let i = 11; i >= 5; i--) {
        oldStreak.push(toDateString(addDays(today, -i)));
      }
      const newStreak = [
        toDateString(addDays(today, -1)),
        toDateString(today),
      ];
      const logs = makeLogs([...oldStreak, ...newStreak]);
      const createdAt = addDays(today, -15);

      const result = streakService.calculateStreaks(logs, allDays, 1, createdAt);
      expect(result.longestStreak).toBe(7);
      expect(result.currentStreak).toBe(2);
    });

    it('should only count scheduled days based on frequency', () => {
      // Only Monday (1) and Wednesday (3)
      const frequency = [1, 3];
      const createdAt = addDays(today, -30);

      // Build logs for all Mondays and Wednesdays in the last 14 days
      const dates = [];
      for (let i = 13; i >= 0; i--) {
        const d = addDays(today, -i);
        const dayOfWeek = d.getUTCDay();
        if (frequency.includes(dayOfWeek)) {
          dates.push(toDateString(d));
        }
      }
      const logs = makeLogs(dates);

      const result = streakService.calculateStreaks(logs, frequency, 1, createdAt);
      expect(result.currentStreak).toBe(dates.length);
      expect(result.longestStreak).toBe(dates.length);
    });

    it('should handle count-based habits with target', () => {
      const dates = [
        toDateString(addDays(today, -2)),
        toDateString(addDays(today, -1)),
        toDateString(today),
      ];
      // Values: 5, 3, 5 with target 5 → only day -2 and today meet target
      const logs = [
        { date: new Date(`${dates[0]}T00:00:00.000Z`), value: 5 },
        { date: new Date(`${dates[1]}T00:00:00.000Z`), value: 3 },
        { date: new Date(`${dates[2]}T00:00:00.000Z`), value: 5 },
      ];
      const createdAt = addDays(today, -5);

      const result = streakService.calculateStreaks(logs, allDays, 5, createdAt);
      expect(result.currentStreak).toBe(1); // Only today
      expect(result.longestStreak).toBe(1);
    });

    it('should handle boolean false as not completed', () => {
      const logs = [
        { date: addDays(today, 0), value: false },
      ];
      const createdAt = addDays(today, -3);

      const result = streakService.calculateStreaks(logs, allDays, 1, createdAt);
      expect(result.currentStreak).toBe(0);
    });

    it('should skip today in current streak if not completed yet', () => {
      const dates = [
        toDateString(addDays(today, -2)),
        toDateString(addDays(today, -1)),
      ];
      const logs = makeLogs(dates);
      const createdAt = addDays(today, -5);

      const result = streakService.calculateStreaks(logs, allDays, 1, createdAt);
      // Today is scheduled but not completed — should be skipped; streak is 2 (days -2, -1)
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(2);
    });

    it('should return 0/0 when no scheduled dates exist', () => {
      // Frequency is empty
      const createdAt = addDays(today, -5);
      const result = streakService.calculateStreaks([], [], 1, createdAt);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it('should use createdDate string over createdAt when both provided', () => {
      // createdAt is UTC April 10 2AM (which is April 9 local in EST)
      // createdDate is the correct local date: April 9
      const createdAt = addDays(today, -3);
      const createdDate = toDateString(addDays(today, -5)); // 2 days earlier

      const dates = [];
      for (let i = 4; i >= 0; i--) {
        dates.push(toDateString(addDays(today, -i)));
      }
      const logs = makeLogs(dates);

      const withCreatedDate = streakService.calculateStreaks(logs, allDays, 1, createdAt, createdDate);
      const withoutCreatedDate = streakService.calculateStreaks(logs, allDays, 1, createdAt);

      // With createdDate (5 days ago), streak should count from day -4
      expect(withCreatedDate.currentStreak).toBe(5);
      // Without createdDate, createdAt is 3 days ago, but logs start from day -4
      // which is before createdAt — the earliest log fallback kicks in
      expect(withoutCreatedDate.currentStreak).toBe(5);
    });

    it('should produce same result for createdDate matching createdAt at noon UTC', () => {
      const createdAt = new Date(`${toDateString(addDays(today, -5))}T12:00:00.000Z`);
      const createdDate = toDateString(addDays(today, -5));

      const dates = [];
      for (let i = 4; i >= 0; i--) {
        dates.push(toDateString(addDays(today, -i)));
      }
      const logs = makeLogs(dates);

      const a = streakService.calculateStreaks(logs, allDays, 1, createdAt, createdDate);
      const b = streakService.calculateStreaks(logs, allDays, 1, createdAt);

      expect(a.currentStreak).toBe(b.currentStreak);
      expect(a.longestStreak).toBe(b.longestStreak);
    });
  });
});

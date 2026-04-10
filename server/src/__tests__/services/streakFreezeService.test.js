import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/StreakFreeze.js', () => ({
  default: {
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

const { default: StreakFreeze } = await import('../../models/StreakFreeze.js');
const { default: User } = await import('../../models/User.js');
const { default: Habit } = await import('../../models/Habit.js');
const { default: streakFreezeService } = await import('../../services/streakFreezeService.js');

describe('StreakFreezeService', () => {
  const userId = 'user123';
  const habitId = 'habit456';
  const dateStr = '2026-04-10';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFreeze', () => {
    it('should throw 404 when user is not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should throw 400 when streak freeze is not enabled', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: false } } });

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'Streak freeze is not enabled. Enable it in settings.',
        statusCode: 400,
      });
    });

    it('should throw 400 when settings.streakFreeze is undefined', async () => {
      User.findById.mockResolvedValue({ settings: {} });

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when habit is not found', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 2 } } });
      Habit.findById.mockResolvedValue(null);

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'Habit not found',
        statusCode: 404,
      });
    });

    it('should throw 403 when user does not own the habit', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 2 } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => 'otherUser' } });

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'You can only freeze your own habits',
        statusCode: 403,
      });
    });

    it('should throw 400 when monthly freeze limit is reached', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 2 } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => userId } });
      StreakFreeze.countDocuments.mockResolvedValue(2);

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'Monthly freeze limit reached for this habit (2/2 used)',
        statusCode: 400,
      });
    });

    it('should use default allowedPerMonth of 2 when not specified', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => userId } });
      StreakFreeze.countDocuments.mockResolvedValue(2);

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'Monthly freeze limit reached for this habit (2/2 used)',
        statusCode: 400,
      });
    });

    it('should throw 400 when the day is already frozen', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 2 } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => userId } });
      StreakFreeze.countDocuments.mockResolvedValue(0);
      StreakFreeze.findOne.mockResolvedValue({ userId, habitId, date: dateStr });

      await expect(streakFreezeService.useFreeze(userId, habitId, dateStr)).rejects.toMatchObject({
        message: 'This day is already frozen',
        statusCode: 400,
      });
    });

    it('should create a freeze record and return status on success', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 3 } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => userId } });
      StreakFreeze.countDocuments.mockResolvedValue(1);
      StreakFreeze.findOne.mockResolvedValue(null);
      StreakFreeze.create.mockResolvedValue({});

      const result = await streakFreezeService.useFreeze(userId, habitId, dateStr);

      expect(StreakFreeze.create).toHaveBeenCalledWith({
        userId,
        habitId,
        date: dateStr,
        month: '2026-04',
      });
      expect(result).toEqual({
        frozenDate: dateStr,
        usedThisMonth: 2,
        allowedPerMonth: 3,
      });
    });

    it('should extract the correct month from dateStr', async () => {
      const janDate = '2026-01-15';
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true, allowedPerMonth: 5 } } });
      Habit.findById.mockResolvedValue({ userId: { toString: () => userId } });
      StreakFreeze.countDocuments.mockResolvedValue(0);
      StreakFreeze.findOne.mockResolvedValue(null);
      StreakFreeze.create.mockResolvedValue({});

      await streakFreezeService.useFreeze(userId, habitId, janDate);

      expect(StreakFreeze.countDocuments).toHaveBeenCalledWith({
        userId,
        habitId,
        month: '2026-01',
      });
      expect(StreakFreeze.create).toHaveBeenCalledWith({
        userId,
        habitId,
        date: janDate,
        month: '2026-01',
      });
    });
  });

  describe('getFreezeStatus', () => {
    it('should return disabled status when user is not found', async () => {
      User.findById.mockResolvedValue(null);
      StreakFreeze.countDocuments.mockResolvedValue(0);
      StreakFreeze.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) });

      const result = await streakFreezeService.getFreezeStatus(userId, habitId);

      expect(result.enabled).toBe(false);
      expect(result.allowedPerMonth).toBe(2);
      expect(result.usedThisMonth).toBe(0);
      expect(result.frozenDates).toEqual([]);
    });

    it('should return enabled status with correct counts and frozen dates', async () => {
      User.findById.mockResolvedValue({
        settings: { streakFreeze: { enabled: true, allowedPerMonth: 4 } },
      });
      StreakFreeze.countDocuments.mockResolvedValue(2);
      StreakFreeze.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            { date: '2026-04-08' },
            { date: '2026-04-05' },
          ]),
        }),
      });

      const result = await streakFreezeService.getFreezeStatus(userId, habitId);

      expect(result).toEqual({
        enabled: true,
        usedThisMonth: 2,
        allowedPerMonth: 4,
        frozenDates: ['2026-04-08', '2026-04-05'],
      });
    });

    it('should default allowedPerMonth to 2 when not set', async () => {
      User.findById.mockResolvedValue({ settings: { streakFreeze: { enabled: true } } });
      StreakFreeze.countDocuments.mockResolvedValue(0);
      StreakFreeze.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) });

      const result = await streakFreezeService.getFreezeStatus(userId, habitId);

      expect(result.allowedPerMonth).toBe(2);
    });
  });

  describe('getBatchFreezeStatus', () => {
    it('should return a map with freeze status for multiple habits', async () => {
      const habitIds = [
        { toString: () => 'h1' },
        { toString: () => 'h2' },
        { toString: () => 'h3' },
      ];
      StreakFreeze.find.mockResolvedValue([
        { habitId: { toString: () => 'h1' }, date: '2026-04-01' },
        { habitId: { toString: () => 'h1' }, date: '2026-04-03' },
        { habitId: { toString: () => 'h3' }, date: '2026-04-05' },
      ]);

      const result = await streakFreezeService.getBatchFreezeStatus(userId, habitIds);

      expect(result).toEqual({
        h1: { frozenDates: ['2026-04-01', '2026-04-03'] },
        h2: { frozenDates: [] },
        h3: { frozenDates: ['2026-04-05'] },
      });
    });

    it('should return empty arrays when no freezes exist', async () => {
      const habitIds = [{ toString: () => 'h1' }];
      StreakFreeze.find.mockResolvedValue([]);

      const result = await streakFreezeService.getBatchFreezeStatus(userId, habitIds);

      expect(result).toEqual({ h1: { frozenDates: [] } });
    });

    it('should query with correct cutoff and habitIds', async () => {
      const habitIds = [{ toString: () => 'h1' }];
      StreakFreeze.find.mockResolvedValue([]);

      await streakFreezeService.getBatchFreezeStatus(userId, habitIds);

      expect(StreakFreeze.find).toHaveBeenCalledWith({
        userId,
        habitId: { $in: habitIds },
        date: { $gte: expect.any(String) },
      });
    });
  });

  describe('getFrozenDatesForHabit', () => {
    it('should return a Set of frozen date strings', async () => {
      StreakFreeze.find.mockResolvedValue([
        { date: '2026-04-01' },
        { date: '2026-04-05' },
        { date: '2026-04-09' },
      ]);

      const result = await streakFreezeService.getFrozenDatesForHabit(userId, habitId);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('2026-04-01')).toBe(true);
      expect(result.has('2026-04-05')).toBe(true);
      expect(result.has('2026-04-09')).toBe(true);
    });

    it('should return an empty Set when no freezes exist', async () => {
      StreakFreeze.find.mockResolvedValue([]);

      const result = await streakFreezeService.getFrozenDatesForHabit(userId, habitId);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should query with a 365-day cutoff', async () => {
      StreakFreeze.find.mockResolvedValue([]);

      await streakFreezeService.getFrozenDatesForHabit(userId, habitId);

      expect(StreakFreeze.find).toHaveBeenCalledWith({
        userId,
        habitId,
        date: { $gte: expect.any(String) },
      });

      const callArgs = StreakFreeze.find.mock.calls[0][0];
      const cutoffDate = new Date(callArgs.date.$gte);
      const now = new Date();
      const diffDays = Math.round((now - cutoffDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });
  });

  describe('getFrozenDatesForUserHabits', () => {
    it('should return a Map of habitId to Set of dates', async () => {
      const habitIds = ['h1', 'h2'];
      StreakFreeze.find.mockResolvedValue([
        { habitId: { toString: () => 'h1' }, date: '2026-04-01' },
        { habitId: { toString: () => 'h1' }, date: '2026-04-02' },
        { habitId: { toString: () => 'h2' }, date: '2026-04-03' },
      ]);

      const result = await streakFreezeService.getFrozenDatesForUserHabits(userId, habitIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);

      const h1Dates = result.get('h1');
      expect(h1Dates).toBeInstanceOf(Set);
      expect(h1Dates.size).toBe(2);
      expect(h1Dates.has('2026-04-01')).toBe(true);
      expect(h1Dates.has('2026-04-02')).toBe(true);

      const h2Dates = result.get('h2');
      expect(h2Dates).toBeInstanceOf(Set);
      expect(h2Dates.size).toBe(1);
      expect(h2Dates.has('2026-04-03')).toBe(true);
    });

    it('should return an empty Map when no freezes exist', async () => {
      StreakFreeze.find.mockResolvedValue([]);

      const result = await streakFreezeService.getFrozenDatesForUserHabits(userId, ['h1']);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should query with correct parameters', async () => {
      const habitIds = ['h1', 'h2'];
      StreakFreeze.find.mockResolvedValue([]);

      await streakFreezeService.getFrozenDatesForUserHabits(userId, habitIds);

      expect(StreakFreeze.find).toHaveBeenCalledWith({
        userId,
        habitId: { $in: habitIds },
        date: { $gte: expect.any(String) },
      });
    });
  });
});

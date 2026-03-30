import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/SharedHabit.js', () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/streakService.js', () => ({
  default: {
    calculateStreaks: jest.fn().mockReturnValue({ currentStreak: 3, longestStreak: 5 }),
  },
}));

jest.unstable_mockModule('../../config/constants.js', () => ({
  ROLES: {
    USER: 'user',
    PREMIUM: 'premium',
    ADMIN: 'admin',
  },
  MAX_BACKDATE_DAYS: 7,
}));

jest.unstable_mockModule('../../services/sharedHabitService.js', () => ({
  default: {
    getUserRoleForHabit: jest.fn(),
    getSharedHabitIdsForUser: jest.fn(),
    getSharingInfo: jest.fn(),
  },
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: SharedHabit } = await import('../../models/SharedHabit.js');
const { default: User } = await import('../../models/User.js');
const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');
const { default: logService } = await import('../../services/logService.js');

describe('LogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sharedHabitService.getUserRoleForHabit.mockResolvedValue(null);
    sharedHabitService.getSharedHabitIdsForUser.mockResolvedValue([]);
    SharedHabit.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
  });

  describe('createOrUpdate', () => {
    it('should throw 400 if habitId or date missing', async () => {
      await expect(
        logService.createOrUpdate('user1', { habitId: null, date: '2025-01-01' })
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        logService.createOrUpdate('user1', { habitId: 'h1', date: null })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 if habit not found', async () => {
      Habit.findById.mockResolvedValue(null);

      await expect(
        logService.createOrUpdate('user1', { habitId: 'h1', date: '2025-01-01', value: true })
      ).rejects.toMatchObject({
        message: 'Habit not found',
        statusCode: 404,
      });
    });

    it('should throw 403 if user does not own the habit', async () => {
      Habit.findById.mockResolvedValue({
        _id: 'h1',
        userId: { toString: () => 'otherUser' },
      });

      await expect(
        logService.createOrUpdate('user1', { habitId: 'h1', date: '2025-01-01', value: true })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw 400 for future dates', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      Habit.findById.mockResolvedValue({
        _id: 'h1',
        userId: { toString: () => 'user1' },
        frequency: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
        createdAt: new Date('2024-01-01'),
        currentStreak: 0,
        longestStreak: 0,
        save: jest.fn(),
      });

      await expect(
        logService.createOrUpdate('user1', { habitId: 'h1', date: futureDate, value: true })
      ).rejects.toMatchObject({
        message: 'Cannot log for future dates',
        statusCode: 400,
      });
    });

    it('should create a new log entry', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const mockHabit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        frequency: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
        createdAt: new Date('2024-01-01'),
        currentStreak: 0,
        longestStreak: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(mockHabit);
      HabitLog.findOneAndUpdate.mockResolvedValue({
        value: { habitId: 'h1', value: true },
        lastErrorObject: { updatedExisting: false },
      });
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const result = await logService.createOrUpdate('user1', {
        habitId: 'h1',
        date: dateStr,
        value: true,
      });

      expect(result.log).toBeDefined();
      expect(result.isNew).toBe(true);
    });

    it('should update existing log entry', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const mockHabit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        frequency: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
        createdAt: new Date('2024-01-01'),
        currentStreak: 0,
        longestStreak: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(mockHabit);
      HabitLog.findOneAndUpdate.mockResolvedValue({
        value: { habitId: 'h1', value: true },
        lastErrorObject: { updatedExisting: true },
      });
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const result = await logService.createOrUpdate('user1', {
        habitId: 'h1',
        date: dateStr,
        value: true,
      });

      expect(result.isNew).toBe(false);
    });
  });

  describe('getDailyLogs', () => {
    it('should return habits with their logs for a given date', async () => {
      const habits = [
        {
          _id: 'h1',
          name: 'Exercise',
          target: 1,
          toObject: jest.fn().mockReturnValue({ _id: 'h1', name: 'Exercise', target: 1 }),
        },
      ];
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(habits),
      });

      const logs = [{ habitId: { toString: () => 'h1' }, value: true }];
      HabitLog.find.mockResolvedValue(logs);

      const result = await logService.getDailyLogs('user1', '2025-06-15');

      expect(result.date).toBe('2025-06-15');
      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].isCompleted).toBe(true);
      expect(result.total).toBe(1);
      expect(result.completed).toBe(1);
    });

    it('should include archived habits when the user logged them on that date', async () => {
      HabitLog.find.mockResolvedValue([
        { habitId: { toString: () => 'h-archived' }, value: true },
      ]);
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: 'h-archived',
            target: 1,
            toObject: jest.fn().mockReturnValue({ _id: 'h-archived', isArchived: true, target: 1 }),
          },
        ]),
      });

      const result = await logService.getDailyLogs('user1', '2025-06-15');

      expect(Habit.find).toHaveBeenCalledWith({
        userId: 'user1',
        $or: [
          { isArchived: false, frequency: { $in: [0] } },
          { _id: { $in: ['h-archived'] } },
        ],
      });
      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].habit.isArchived).toBe(true);
    });

    it('should show personal streaks for shared habits', async () => {
      sharedHabitService.getSharedHabitIdsForUser.mockResolvedValue([
        { habitId: 'sh1', ownerId: 'owner1', role: 'member' },
      ]);
      Habit.find
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([
            {
              _id: 'sh1',
              target: 1,
              frequency: [0],
              createdAt: new Date('2024-01-01'),
              currentStreak: 99,
              longestStreak: 99,
              toObject: jest.fn().mockReturnValue({
                _id: 'sh1',
                target: 1,
                currentStreak: 99,
                longestStreak: 99,
              }),
            },
          ]),
        });
      User.find.mockResolvedValue([{ _id: { toString: () => 'owner1' }, name: 'Owner' }]);
      HabitLog.find
        .mockResolvedValueOnce([{ habitId: { toString: () => 'sh1' }, value: true }])
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([{ habitId: { toString: () => 'sh1' }, value: true }]),
        });

      const result = await logService.getDailyLogs('user1', '2025-06-15');

      // These come from the streakService mock above, proving we override the owner's stored streaks.
      expect(result.habits[0].habit.currentStreak).toBe(3);
      expect(result.habits[0].habit.longestStreak).toBe(5);
    });

    it('should mark habit as not completed when no log exists', async () => {
      const habits = [
        {
          _id: 'h1',
          target: 1,
          toObject: jest.fn().mockReturnValue({ _id: 'h1', target: 1 }),
        },
      ];
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(habits),
      });
      HabitLog.find.mockResolvedValue([]);

      const result = await logService.getDailyLogs('user1', '2025-06-15');
      expect(result.habits[0].isCompleted).toBe(false);
      expect(result.habits[0].log).toBeNull();
    });
  });

  describe('getRangeLogs', () => {
    it('should return habits and logs for date range', async () => {
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'h1', name: 'Exercise', toObject: () => ({ _id: 'h1', name: 'Exercise' }) }]),
      });
      HabitLog.find.mockResolvedValue([{ habitId: { toString: () => 'h1' }, value: true }]);

      const result = await logService.getRangeLogs('user1', '2025-01-01', '2025-01-31');

      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-01-31');
      expect(result.habits).toHaveLength(1);
      expect(result.logs).toHaveLength(1);
    });

    it('should use personal streaks for shared habits in range logs', async () => {
      sharedHabitService.getSharedHabitIdsForUser.mockResolvedValue([
        { habitId: 'sh1', ownerId: 'owner1', role: 'member' },
      ]);
      Habit.find
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([
            {
              _id: 'sh1',
              target: 1,
              frequency: [0],
              createdAt: new Date('2024-01-01'),
              currentStreak: 99,
              longestStreak: 99,
              toObject: jest.fn().mockReturnValue({
                _id: 'sh1',
                target: 1,
                currentStreak: 99,
                longestStreak: 99,
              }),
            },
          ]),
        });
      User.find.mockResolvedValue([{ _id: { toString: () => 'owner1' }, name: 'Owner' }]);
      HabitLog.find
        .mockResolvedValueOnce([{ habitId: { toString: () => 'sh1' }, value: true }])
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([{ habitId: { toString: () => 'sh1' }, value: true }]),
        });

      const result = await logService.getRangeLogs('user1', '2025-01-01', '2025-01-31');

      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].currentStreak).toBe(3);
      expect(result.habits[0].longestStreak).toBe(5);
      expect(result.habits[0].isShared).toBe(true);
      expect(result.habits[0].sharedBy).toBe('Owner');
      expect(result.habits[0].myRole).toBe('member');
    });
  });

  describe('getMonthlyLogs', () => {
    it('should return habits and logs for a month', async () => {
      Habit.find.mockResolvedValue([{ _id: 'h1', name: 'Read', toObject: () => ({ _id: 'h1', name: 'Read' }) }]);
      HabitLog.find.mockResolvedValue([{ habitId: { toString: () => 'h1' }, value: true }]);

      const result = await logService.getMonthlyLogs('user1', 6, 2025);

      expect(result.month).toBe(6);
      expect(result.year).toBe(2025);
      expect(result.habits).toHaveLength(1);
    });
  });

  describe('getYearlyLogs', () => {
    it('should return habits, monthly stats, and logs', async () => {
      Habit.find.mockResolvedValue([{ _id: 'h1', name: 'Exercise' }]);
      HabitLog.aggregate.mockResolvedValue([
        { _id: { month: 1 }, totalLogs: 30, completedLogs: 25 },
      ]);
      HabitLog.find.mockResolvedValue([
        { habitId: 'h1', value: true },
        { habitId: 'h2', value: true },
      ]);

      const result = await logService.getYearlyLogs(
        '507f1f77bcf86cd799439011', // valid ObjectId string
        2025
      );

      expect(result.year).toBe(2025);
      expect(result.monthlyStats).toHaveLength(1);
      expect(result.monthlyStats[0].totalLogs).toBe(30);
      expect(result.logs).toHaveLength(1);
    });
  });
});

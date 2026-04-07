import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: {
    getScheduledUsers: jest.fn(),
    sendWithUser: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    sendWeeklySummaryEmail: jest.fn(),
  },
}));

const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: Habit } = await import('../../models/Habit.js');
const { default: notificationService } = await import('../../services/notificationService.js');
const { default: weeklySummaryService } = await import('../../services/weeklySummaryService.js');

describe('WeeklySummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('should return null if user has no habits', async () => {
      Habit.find.mockResolvedValue([]);
      const result = await weeklySummaryService.generateSummary('user1');
      expect(result).toBeNull();
    });

    it('should use UTC dates for date range calculations', async () => {
      const habit = {
        _id: 'h1',
        frequency: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
        currentStreak: 3,
        name: 'Exercise',
      };
      Habit.find.mockResolvedValue([habit]);
      HabitLog.find.mockResolvedValue([]);

      await weeklySummaryService.generateSummary('user1');

      // Verify the date range query uses UTC dates (no time-of-day offset)
      const findCall = HabitLog.find.mock.calls[0][0];
      const startDate = findCall.date.$gte;
      const endDate = findCall.date.$lt;

      // Both dates should be at UTC midnight
      expect(startDate.getUTCHours()).toBe(0);
      expect(startDate.getUTCMinutes()).toBe(0);
      expect(endDate.getUTCHours()).toBe(0);
      expect(endDate.getUTCMinutes()).toBe(0);

      // Range should be exactly 7 days
      const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });

    it('should calculate completion rate correctly', async () => {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const yesterdayUTC = new Date(todayUTC);
      yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

      const habit = {
        _id: { toString: () => 'h1' },
        frequency: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
        currentStreak: 1,
        name: 'Exercise',
      };
      Habit.find.mockResolvedValue([habit]);

      // One completed log for yesterday
      HabitLog.find.mockResolvedValue([{
        habitId: { toString: () => 'h1' },
        date: yesterdayUTC,
        value: true,
      }]);

      const result = await weeklySummaryService.generateSummary('user1');

      expect(result).not.toBeNull();
      expect(result.totalHabits).toBe(1);
      expect(result.totalExpected).toBe(7);
      expect(result.completedCount).toBe(1);
      expect(result.bestHabit).toBe('Exercise');
    });
  });

  describe('sendWeeklySummaries', () => {
    it('should send summaries to email-only users returned by scheduled selection', async () => {
      const user = {
        _id: 'user1',
        email: 'user@test.com',
        emailVerified: true,
        settings: {
          notifications: {
            weeklySummary: { push: false, email: true },
          },
        },
      };
      const summary = {
        completionRate: 80,
        completedCount: 4,
        totalExpected: 5,
        bestHabit: 'Exercise',
        bestStreak: 8,
      };

      notificationService.getScheduledUsers.mockResolvedValue([user]);
      notificationService.sendWithUser.mockResolvedValue();
      weeklySummaryService.generateSummary = jest.fn().mockResolvedValue(summary);

      await weeklySummaryService.sendWeeklySummaries();

      expect(notificationService.getScheduledUsers).toHaveBeenCalledWith(
        'weeklySummary',
        'name email emailVerified settings'
      );
      expect(weeklySummaryService.generateSummary).toHaveBeenCalledWith('user1');
      expect(notificationService.sendWithUser).toHaveBeenCalledWith(
        user,
        'weeklySummary',
        expect.objectContaining({
          pushPayload: expect.objectContaining({
            title: 'Weekly Summary: 80% completion',
          }),
          emailFn: expect.any(Function),
        })
      );
    });
  });

  describe('sendWeeklySummaryForUser', () => {
    it('should return false when there is no summary to send', async () => {
      weeklySummaryService.generateSummary = jest.fn().mockResolvedValue(null);

      const result = await weeklySummaryService.sendWeeklySummaryForUser({ _id: 'user1' });

      expect(result).toBe(false);
      expect(notificationService.sendWithUser).not.toHaveBeenCalled();
    });
  });
});

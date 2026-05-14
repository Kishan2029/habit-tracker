import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSchedule = jest.fn();

jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: mockSchedule },
}));

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: {
    getScheduledUsers: jest.fn(),
    sendWithUser: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: { sendDailyReminderEmail: jest.fn() },
}));

jest.unstable_mockModule('../../utils/dateHelpers.js', () => ({
  getHourInTimezone: jest.fn(),
  getTodayInTimezone: jest.fn(),
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: notificationService } = await import('../../services/notificationService.js');
const { default: emailService } = await import('../../services/emailService.js');
const { getHourInTimezone, getTodayInTimezone } = await import('../../utils/dateHelpers.js');
const { startDailyReminderJob } = await import('../../jobs/dailyReminder.js');

describe('Daily Reminder Job', () => {
  let cronCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    startDailyReminderJob();
    cronCallback = mockSchedule.mock.calls[0][1];
  });

  it('should schedule cron job to run every hour', () => {
    expect(mockSchedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });

  it('should return early when no users are found', async () => {
    notificationService.getScheduledUsers.mockResolvedValue([]);

    await cronCallback();

    expect(notificationService.getScheduledUsers).toHaveBeenCalledWith(
      'dailyReminders',
      'name email emailVerified settings'
    );
    expect(Habit.find).not.toHaveBeenCalled();
  });

  it('should return early when no users match the reminder hour', async () => {
    const user = {
      _id: 'u1',
      settings: { timezone: 'UTC', reminderTime: '08:00' },
    };
    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(14); // not 8

    await cronCallback();

    expect(Habit.find).not.toHaveBeenCalled();
  });

  it('should send reminder for pending habits when user local time matches', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z'); // Friday = day 5
    const user = {
      _id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      settings: { timezone: 'UTC', reminderTime: '08:00' },
    };
    const habit = { _id: 'h1', userId: 'u1', name: 'Exercise', isArchived: false };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(8);
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]); // no logs -> habit is pending
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(Habit.find).toHaveBeenCalledWith({
      userId: { $in: ['u1'] },
      isArchived: false,
      frequency: { $in: [today.getUTCDay()] },
    });
    expect(HabitLog.find).toHaveBeenCalledWith({
      userId: { $in: ['u1'] },
      date: today,
      habitId: { $in: ['h1'] },
    });
    expect(notificationService.sendWithUser).toHaveBeenCalledWith(
      user,
      'dailyReminders',
      expect.objectContaining({
        pushPayload: expect.objectContaining({
          title: 'Daily Habits Reminder',
          body: 'You have 1 habit to complete today: Exercise',
          tag: 'daily-reminder',
        }),
        emailFn: expect.any(Function),
      })
    );
  });

  it('should skip users who have already completed all habits', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z');
    const user = { _id: 'u1', settings: { timezone: 'UTC', reminderTime: '09:00' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Read' };
    const log = { userId: 'u1', habitId: 'h1', date: today };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(9);
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([log]); // habit already logged

    await cronCallback();

    expect(notificationService.sendWithUser).not.toHaveBeenCalled();
  });

  it('should use default timezone UTC and reminderTime 08:00 when settings are missing', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Bob', email: 'bob@test.com' }; // no settings
    const habit = { _id: 'h1', userId: 'u1', name: 'Meditate' };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(8); // default reminderTime is 08:00
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(getHourInTimezone).toHaveBeenCalledWith(expect.any(Date), 'UTC');
    expect(notificationService.sendWithUser).toHaveBeenCalled();
  });

  it('should truncate habit names to 3 and show extra count', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Carol', email: 'carol@test.com', settings: { timezone: 'UTC', reminderTime: '08:00' } };
    const habits = [
      { _id: 'h1', userId: 'u1', name: 'A' },
      { _id: 'h2', userId: 'u1', name: 'B' },
      { _id: 'h3', userId: 'u1', name: 'C' },
      { _id: 'h4', userId: 'u1', name: 'D' },
      { _id: 'h5', userId: 'u1', name: 'E' },
    ];

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(8);
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue(habits);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    const call = notificationService.sendWithUser.mock.calls[0];
    expect(call[2].pushPayload.body).toBe(
      'You have 5 habits to complete today: A, B, C and 2 more'
    );
  });

  it('should invoke emailFn with emailService.sendDailyReminderEmail', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Dave', email: 'dave@test.com', settings: { timezone: 'UTC', reminderTime: '08:00' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Run' };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(8);
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    // Extract the emailFn and invoke it
    const emailFn = notificationService.sendWithUser.mock.calls[0][2].emailFn;
    emailFn(user);
    expect(emailService.sendDailyReminderEmail).toHaveBeenCalledWith('dave@test.com', 'Dave', [habit]);
  });

  it('should handle per-user errors gracefully and continue processing', async () => {
    const today = new Date('2026-04-10T00:00:00.000Z');
    const user1 = { _id: 'u1', name: 'Err', email: 'e@test.com', settings: { timezone: 'UTC', reminderTime: '08:00' } };
    const user2 = { _id: 'u2', name: 'Ok', email: 'ok@test.com', settings: { timezone: 'UTC', reminderTime: '08:00' } };
    const habit1 = { _id: 'h1', userId: 'u1', name: 'H1' };
    const habit2 = { _id: 'h2', userId: 'u2', name: 'H2' };

    notificationService.getScheduledUsers.mockResolvedValue([user1, user2]);
    getHourInTimezone.mockReturnValue(8);
    getTodayInTimezone.mockReturnValue(today);
    Habit.find.mockResolvedValue([habit1, habit2]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser
      .mockRejectedValueOnce(new Error('Push failed'))
      .mockResolvedValueOnce();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Daily Reminder] Error for user u1:',
      'Push failed'
    );
    // Second user should still get the notification
    expect(notificationService.sendWithUser).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it('should handle top-level cron errors gracefully', async () => {
    notificationService.getScheduledUsers.mockRejectedValue(new Error('DB down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Cron] Daily reminder job failed:',
      'DB down'
    );
    consoleSpy.mockRestore();
  });
});

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
  default: { sendMissedHabitEmail: jest.fn() },
}));

jest.unstable_mockModule('../../utils/dateHelpers.js', () => ({
  getHourInTimezone: jest.fn(),
  getYesterdayInTimezone: jest.fn(),
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: notificationService } = await import('../../services/notificationService.js');
const { default: emailService } = await import('../../services/emailService.js');
const { getHourInTimezone, getYesterdayInTimezone } = await import('../../utils/dateHelpers.js');
const { startMissedAlertJob } = await import('../../jobs/missedAlert.js');

describe('Missed Alert Job', () => {
  let cronCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    startMissedAlertJob();
    cronCallback = mockSchedule.mock.calls[0][1];
  });

  it('should schedule cron job to run every hour', () => {
    expect(mockSchedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });

  it('should return early when no users are found', async () => {
    notificationService.getScheduledUsers.mockResolvedValue([]);

    await cronCallback();

    expect(notificationService.getScheduledUsers).toHaveBeenCalledWith(
      'missedAlerts',
      'name email emailVerified settings'
    );
    expect(Habit.find).not.toHaveBeenCalled();
  });

  it('should return early when no users match the missed alert hour (10 AM)', async () => {
    const user = {
      _id: 'u1',
      settings: { timezone: 'UTC' },
    };
    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(14); // not 10

    await cronCallback();

    expect(Habit.find).not.toHaveBeenCalled();
  });

  it('should send missed alert for incomplete habits from yesterday', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z'); // Wednesday = day 3
    const user = {
      _id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      settings: { timezone: 'UTC' },
    };
    const habit = { _id: 'h1', userId: 'u1', name: 'Exercise', isArchived: false, target: 1 };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]); // no logs -> missed
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(Habit.find).toHaveBeenCalledWith({
      userId: { $in: ['u1'] },
      isArchived: false,
      frequency: { $in: [yesterday.getUTCDay()] },
    });
    expect(HabitLog.find).toHaveBeenCalledWith({
      userId: { $in: ['u1'] },
      date: yesterday,
      habitId: { $in: ['h1'] },
    });
    expect(notificationService.sendWithUser).toHaveBeenCalledWith(
      user,
      'missedAlerts',
      expect.objectContaining({
        pushPayload: expect.objectContaining({
          title: 'Missed habits yesterday',
          body: 'You missed 1 habit yesterday: Exercise. Don\'t break your streak!',
          tag: 'missed-alert',
        }),
        emailFn: expect.any(Function),
      })
    );
  });

  it('should skip users who completed all habits (boolean value true)', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', settings: { timezone: 'UTC' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Read', target: 0 };
    const log = { userId: 'u1', habitId: 'h1', date: yesterday, value: true };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([log]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(notificationService.sendWithUser).not.toHaveBeenCalled();
  });

  it('should skip habits where numeric log value meets target', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', settings: { timezone: 'UTC' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Water', target: 8 };
    const log = { userId: 'u1', habitId: 'h1', date: yesterday, value: 10 };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([log]);

    await cronCallback();

    expect(notificationService.sendWithUser).not.toHaveBeenCalled();
  });

  it('should alert when numeric log value is below target', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Bob', email: 'bob@test.com', settings: { timezone: 'UTC' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Water', target: 8 };
    const log = { userId: 'u1', habitId: 'h1', date: yesterday, value: 3 };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([log]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(notificationService.sendWithUser).toHaveBeenCalledTimes(1);
  });

  it('should treat boolean false as incomplete', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Carol', email: 'c@test.com', settings: { timezone: 'UTC' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Journal', target: 0 };
    const log = { userId: 'u1', habitId: 'h1', date: yesterday, value: false };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([log]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(notificationService.sendWithUser).toHaveBeenCalledTimes(1);
  });

  it('should use default timezone UTC when settings are missing', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Dan', email: 'dan@test.com' }; // no settings
    const habit = { _id: 'h1', userId: 'u1', name: 'Walk' };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    expect(getHourInTimezone).toHaveBeenCalledWith(expect.any(Date), 'UTC');
    expect(notificationService.sendWithUser).toHaveBeenCalled();
  });

  it('should truncate habit names to 3 and show extra count', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Eve', email: 'e@test.com', settings: { timezone: 'UTC' } };
    const habits = [
      { _id: 'h1', userId: 'u1', name: 'A', target: 1 },
      { _id: 'h2', userId: 'u1', name: 'B', target: 1 },
      { _id: 'h3', userId: 'u1', name: 'C', target: 1 },
      { _id: 'h4', userId: 'u1', name: 'D', target: 1 },
    ];

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue(habits);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    const call = notificationService.sendWithUser.mock.calls[0];
    expect(call[2].pushPayload.body).toBe(
      "You missed 4 habits yesterday: A, B, C and 1 more. Don't break your streak!"
    );
  });

  it('should invoke emailFn with emailService.sendMissedHabitEmail', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user = { _id: 'u1', name: 'Frank', email: 'frank@test.com', settings: { timezone: 'UTC' } };
    const habit = { _id: 'h1', userId: 'u1', name: 'Code' };

    notificationService.getScheduledUsers.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser.mockResolvedValue();

    await cronCallback();

    const emailFn = notificationService.sendWithUser.mock.calls[0][2].emailFn;
    emailFn(user);
    expect(emailService.sendMissedHabitEmail).toHaveBeenCalledWith('frank@test.com', 'Frank', [habit]);
  });

  it('should handle per-user errors gracefully and continue processing', async () => {
    const yesterday = new Date('2026-04-09T00:00:00.000Z');
    const user1 = { _id: 'u1', name: 'Err', email: 'e@test.com', settings: { timezone: 'UTC' } };
    const user2 = { _id: 'u2', name: 'Ok', email: 'ok@test.com', settings: { timezone: 'UTC' } };
    const habit1 = { _id: 'h1', userId: 'u1', name: 'H1' };
    const habit2 = { _id: 'h2', userId: 'u2', name: 'H2' };

    notificationService.getScheduledUsers.mockResolvedValue([user1, user2]);
    getHourInTimezone.mockReturnValue(10);
    getYesterdayInTimezone.mockReturnValue(yesterday);
    Habit.find.mockResolvedValue([habit1, habit2]);
    HabitLog.find.mockResolvedValue([]);
    notificationService.sendWithUser
      .mockRejectedValueOnce(new Error('Push failed'))
      .mockResolvedValueOnce();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Missed Alert] Error for user u1:',
      'Push failed'
    );
    expect(notificationService.sendWithUser).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it('should handle top-level cron errors gracefully', async () => {
    notificationService.getScheduledUsers.mockRejectedValue(new Error('DB down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Cron] Missed alert job failed:',
      'DB down'
    );
    consoleSpy.mockRestore();
  });
});

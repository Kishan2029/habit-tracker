import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSchedule = jest.fn();

jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../services/weeklySummaryService.js', () => ({
  default: {
    sendWeeklySummaryForUser: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/dateHelpers.js', () => ({
  getHourInTimezone: jest.fn(),
  getTodayInTimezone: jest.fn(),
}));

const { default: User } = await import('../../models/User.js');
const { default: weeklySummaryService } = await import('../../services/weeklySummaryService.js');
const { getHourInTimezone, getTodayInTimezone } = await import('../../utils/dateHelpers.js');
const { startWeeklySummaryJob } = await import('../../jobs/weeklySummary.js');

describe('Weekly Summary Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should schedule cron job to run every hour', () => {
    startWeeklySummaryJob();

    expect(mockSchedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });

  it('should send summary to users whose local time is 9 AM on Sunday', async () => {
    const user = {
      _id: 'u1',
      settings: { timezone: 'America/New_York', notifications: { weeklySummary: { push: true } } },
    };
    User.find.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(9);
    // Sunday = day 0
    getTodayInTimezone.mockReturnValue(new Date('2026-04-05T00:00:00.000Z')); // a Sunday
    weeklySummaryService.sendWeeklySummaryForUser.mockResolvedValue(true);

    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(weeklySummaryService.sendWeeklySummaryForUser).toHaveBeenCalledWith(user);
  });

  it('should skip users whose local time is not 9 AM', async () => {
    const user = {
      _id: 'u1',
      settings: { timezone: 'UTC', notifications: { weeklySummary: { push: true } } },
    };
    User.find.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(14); // not 9
    getTodayInTimezone.mockReturnValue(new Date('2026-04-05T00:00:00.000Z'));

    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(weeklySummaryService.sendWeeklySummaryForUser).not.toHaveBeenCalled();
  });

  it('should skip users when it is not Sunday in their timezone', async () => {
    const user = {
      _id: 'u1',
      settings: { timezone: 'UTC', notifications: { weeklySummary: { push: true } } },
    };
    User.find.mockResolvedValue([user]);
    getHourInTimezone.mockReturnValue(9);
    // Monday = day 1
    getTodayInTimezone.mockReturnValue(new Date('2026-04-06T00:00:00.000Z'));

    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(weeklySummaryService.sendWeeklySummaryForUser).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully when weekly summary fails', async () => {
    User.find.mockRejectedValue(new Error('DB down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Cron] Weekly summary failed:',
      'DB down'
    );
    consoleSpy.mockRestore();
  });
});

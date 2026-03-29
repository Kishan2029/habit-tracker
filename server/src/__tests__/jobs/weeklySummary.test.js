import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSchedule = jest.fn();

jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}));

jest.unstable_mockModule('../../services/weeklySummaryService.js', () => ({
  default: {
    sendWeeklySummaries: jest.fn(),
  },
}));

const { default: weeklySummaryService } = await import('../../services/weeklySummaryService.js');
const { startWeeklySummaryJob } = await import('../../jobs/weeklySummary.js');

describe('Weekly Summary Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should schedule cron job for Sunday at 9 AM', () => {
    startWeeklySummaryJob();

    expect(mockSchedule).toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));
  });

  it('should call sendWeeklySummaries when cron fires', async () => {
    weeklySummaryService.sendWeeklySummaries.mockResolvedValue();
    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(weeklySummaryService.sendWeeklySummaries).toHaveBeenCalled();
  });

  it('should handle errors gracefully when weekly summary fails', async () => {
    weeklySummaryService.sendWeeklySummaries.mockRejectedValue(new Error('DB down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    startWeeklySummaryJob();

    const cronCallback = mockSchedule.mock.calls[0][1];
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Cron] Weekly summary failed:'),
      'DB down'
    );
    consoleSpy.mockRestore();
  });
});

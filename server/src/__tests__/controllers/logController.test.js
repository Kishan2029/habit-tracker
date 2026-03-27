import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/logService.js', () => ({
  default: {
    createOrUpdate: jest.fn(),
    getDailyLogs: jest.fn(),
    getMonthlyLogs: jest.fn(),
    getYearlyLogs: jest.fn(),
    getRangeLogs: jest.fn(),
  },
}));

const { default: logService } = await import('../../services/logService.js');
const {
  createOrUpdateLog,
  getDailyLogs,
  getMonthlyLogs,
  getYearlyLogs,
  getRangeLogs,
} = await import('../../controllers/logController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('LogController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('createOrUpdateLog', () => {
    it('should return 201 for new log', async () => {
      logService.createOrUpdate.mockResolvedValue({
        log: { _id: 'l1', value: true },
        isNew: true,
      });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', date: '2025-01-01', value: true } };
      await createOrUpdateLog(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Log created' })
      );
    });

    it('should return 200 for updated log', async () => {
      logService.createOrUpdate.mockResolvedValue({
        log: { _id: 'l1', value: true },
        isNew: false,
      });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', date: '2025-01-01', value: true } };
      await createOrUpdateLog(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Log updated' })
      );
    });
  });

  describe('getDailyLogs', () => {
    it('should return daily logs for given date', async () => {
      const data = { date: '2025-01-01', habits: [], total: 0, completed: 0 };
      logService.getDailyLogs.mockResolvedValue(data);

      const req = { user: { _id: 'u1' }, query: { date: '2025-01-01' } };
      await getDailyLogs(req, res, next);

      expect(logService.getDailyLogs).toHaveBeenCalledWith('u1', '2025-01-01');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data })
      );
    });
  });

  describe('getMonthlyLogs', () => {
    it('should parse month and year from query', async () => {
      logService.getMonthlyLogs.mockResolvedValue({ month: 6, year: 2025 });

      const req = { user: { _id: 'u1' }, query: { month: '6', year: '2025' } };
      await getMonthlyLogs(req, res, next);

      expect(logService.getMonthlyLogs).toHaveBeenCalledWith('u1', 6, 2025);
    });
  });

  describe('getYearlyLogs', () => {
    it('should parse year from query', async () => {
      logService.getYearlyLogs.mockResolvedValue({ year: 2025 });

      const req = { user: { _id: 'u1' }, query: { year: '2025' } };
      await getYearlyLogs(req, res, next);

      expect(logService.getYearlyLogs).toHaveBeenCalledWith('u1', 2025);
    });
  });

  describe('getRangeLogs', () => {
    it('should pass start and end from query', async () => {
      logService.getRangeLogs.mockResolvedValue({ startDate: '2025-01-01', endDate: '2025-01-31' });

      const req = { user: { _id: 'u1' }, query: { start: '2025-01-01', end: '2025-01-31' } };
      await getRangeLogs(req, res, next);

      expect(logService.getRangeLogs).toHaveBeenCalledWith('u1', '2025-01-01', '2025-01-31');
    });
  });
});

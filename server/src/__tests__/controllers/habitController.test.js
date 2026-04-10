import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/habitService.js', () => ({
  default: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
    delete: jest.fn(),
    reorder: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/streakFreezeService.js', () => ({
  default: {
    useFreeze: jest.fn(),
    getFreezeStatus: jest.fn(),
    getBatchFreezeStatus: jest.fn(),
  },
}));

const { default: habitService } = await import('../../services/habitService.js');
const { default: streakFreezeService } = await import('../../services/streakFreezeService.js');
const {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  deleteHabit,
  reorderHabits,
  freezeDay,
  getFreezeStatus,
  getBatchFreezeStatus,
} = await import('../../controllers/habitController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('HabitController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('getHabits', () => {
    it('should return habits list', async () => {
      const habits = [{ name: 'Exercise' }];
      habitService.getAll.mockResolvedValue(habits);

      const req = { user: { _id: 'u1' }, query: {} };
      await getHabits(req, res, next);

      expect(habitService.getAll).toHaveBeenCalledWith('u1', {
        includeArchived: false,
        category: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { habits } })
      );
    });

    it('should pass includeArchived and category from query', async () => {
      habitService.getAll.mockResolvedValue([]);

      const req = { user: { _id: 'u1' }, query: { includeArchived: 'true', category: 'health' } };
      await getHabits(req, res, next);

      expect(habitService.getAll).toHaveBeenCalledWith('u1', {
        includeArchived: true,
        category: 'health',
      });
    });
  });

  describe('getHabit', () => {
    it('should return single habit', async () => {
      const habit = { _id: 'h1', name: 'Read' };
      habitService.getById.mockResolvedValue(habit);

      const req = { user: { _id: 'u1' }, params: { id: 'h1' } };
      await getHabit(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { habit } })
      );
    });
  });

  describe('createHabit', () => {
    it('should create habit and return 201', async () => {
      const habit = { _id: 'h1', name: 'Meditate' };
      habitService.create.mockResolvedValue(habit);

      const req = { user: { _id: 'u1' }, body: { name: 'Meditate', type: 'boolean' } };
      await createHabit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(habitService.create).toHaveBeenCalledWith('u1', { name: 'Meditate', type: 'boolean' });
    });
  });

  describe('updateHabit', () => {
    it('should update habit', async () => {
      const habit = { _id: 'h1', name: 'Updated' };
      habitService.update.mockResolvedValue(habit);

      const req = { user: { _id: 'u1' }, params: { id: 'h1' }, body: { name: 'Updated' } };
      await updateHabit(req, res, next);

      expect(habitService.update).toHaveBeenCalledWith('h1', 'u1', { name: 'Updated' });
    });
  });

  describe('archiveHabit', () => {
    it('should archive habit', async () => {
      habitService.archive.mockResolvedValue({ _id: 'h1', isArchived: true });

      const req = { user: { _id: 'u1' }, params: { id: 'h1' } };
      await archiveHabit(req, res, next);

      expect(habitService.archive).toHaveBeenCalledWith('h1', 'u1');
    });
  });

  describe('unarchiveHabit', () => {
    it('should unarchive habit', async () => {
      habitService.unarchive.mockResolvedValue({ _id: 'h1', isArchived: false });

      const req = { user: { _id: 'u1' }, params: { id: 'h1' } };
      await unarchiveHabit(req, res, next);

      expect(habitService.unarchive).toHaveBeenCalledWith('h1', 'u1');
    });
  });

  describe('deleteHabit', () => {
    it('should delete habit', async () => {
      habitService.delete.mockResolvedValue({ message: 'Habit and associated logs deleted' });

      const req = { user: { _id: 'u1' }, params: { id: 'h1' } };
      await deleteHabit(req, res, next);

      expect(habitService.delete).toHaveBeenCalledWith('h1', 'u1');
    });
  });

  describe('reorderHabits', () => {
    it('should reorder habits', async () => {
      const items = [{ id: 'h1', sortOrder: 0 }, { id: 'h2', sortOrder: 1 }];
      habitService.reorder.mockResolvedValue({ message: 'Habits reordered' });

      const req = { user: { _id: 'u1' }, body: { items } };
      await reorderHabits(req, res, next);

      expect(habitService.reorder).toHaveBeenCalledWith('u1', items);
    });
  });

  describe('freezeDay', () => {
    it('should freeze a day for a habit', async () => {
      const mockData = { frozen: true };
      streakFreezeService.useFreeze.mockResolvedValue(mockData);

      const req = { user: { _id: 'u1' }, params: { id: 'h1' }, body: { date: '2025-01-15' } };
      await freezeDay(req, res, next);

      expect(streakFreezeService.useFreeze).toHaveBeenCalledWith('u1', 'h1', '2025-01-15');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Day frozen', data: mockData })
      );
    });
  });

  describe('getFreezeStatus', () => {
    it('should return freeze status for a habit', async () => {
      const mockData = { freezesRemaining: 2, freezesUsed: 1 };
      streakFreezeService.getFreezeStatus.mockResolvedValue(mockData);

      const req = { user: { _id: 'u1' }, params: { id: 'h1' } };
      await getFreezeStatus(req, res, next);

      expect(streakFreezeService.getFreezeStatus).toHaveBeenCalledWith('u1', 'h1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Freeze status retrieved', data: mockData })
      );
    });
  });

  describe('getBatchFreezeStatus', () => {
    it('should return batch freeze status for multiple habits', async () => {
      const mockData = { h1: { freezesRemaining: 2 }, h2: { freezesRemaining: 1 } };
      streakFreezeService.getBatchFreezeStatus.mockResolvedValue(mockData);

      const req = { user: { _id: 'u1' }, query: { ids: 'h1,h2' } };
      await getBatchFreezeStatus(req, res, next);

      expect(streakFreezeService.getBatchFreezeStatus).toHaveBeenCalledWith('u1', ['h1', 'h2']);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Batch freeze status retrieved', data: mockData })
      );
    });

    it('should return early when ids is empty', async () => {
      const req = { user: { _id: 'u1' }, query: { ids: '' } };
      await getBatchFreezeStatus(req, res, next);

      expect(streakFreezeService.getBatchFreezeStatus).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'No habits specified', data: {} })
      );
    });

    it('should return early when req.query.ids is undefined', async () => {
      const req = { user: { _id: 'u1' }, query: {} };
      await getBatchFreezeStatus(req, res, next);

      expect(streakFreezeService.getBatchFreezeStatus).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'No habits specified', data: {} })
      );
    });

    it('should return early when more than 50 ids are provided', async () => {
      const manyIds = Array.from({ length: 51 }, (_, i) => `h${i}`).join(',');
      const req = { user: { _id: 'u1' }, query: { ids: manyIds } };
      await getBatchFreezeStatus(req, res, next);

      expect(streakFreezeService.getBatchFreezeStatus).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Too many habits (max 50)', data: {} })
      );
    });
  });
});

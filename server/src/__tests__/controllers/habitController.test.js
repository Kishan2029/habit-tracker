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

const { default: habitService } = await import('../../services/habitService.js');
const {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  deleteHabit,
  reorderHabits,
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
});

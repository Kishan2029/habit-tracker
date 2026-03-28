import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndDelete: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: {
    deleteMany: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/SharedHabit.js', () => ({
  default: {
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/cacheService.js', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    delByPrefix: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/sharedHabitService.js', () => ({
  default: {
    getUserRoleForHabit: jest.fn(),
  },
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: SharedHabit } = await import('../../models/SharedHabit.js');
const { default: cache } = await import('../../services/cacheService.js');
const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');
const { default: habitService } = await import('../../services/habitService.js');

describe('HabitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sharedHabitService.getUserRoleForHabit.mockResolvedValue(null);
  });

  describe('_cacheKey', () => {
    it('should generate cache key with defaults', () => {
      const key = habitService._cacheKey('user1');
      expect(key).toBe('habits:user1:archived=false:cat=all');
    });

    it('should include options in cache key', () => {
      const key = habitService._cacheKey('user1', { includeArchived: true, category: 'health' });
      expect(key).toBe('habits:user1:archived=true:cat=health');
    });
  });

  describe('getAll', () => {
    it('should return cached habits if available', async () => {
      const cachedHabits = [{ name: 'Exercise' }];
      cache.get.mockReturnValue(cachedHabits);

      const result = await habitService.getAll('user1');
      expect(result).toEqual(cachedHabits);
      expect(Habit.find).not.toHaveBeenCalled();
    });

    it('should query DB and cache when cache miss', async () => {
      cache.get.mockReturnValue(undefined);
      const habits = [{ name: 'Exercise' }];
      Habit.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(habits) }),
      });

      const result = await habitService.getAll('user1');
      expect(result).toEqual(habits);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should filter by category when provided', async () => {
      cache.get.mockReturnValue(undefined);
      Habit.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });

      await habitService.getAll('user1', { category: 'fitness' });
      expect(Habit.find).toHaveBeenCalledWith({
        userId: 'user1',
        isArchived: false,
        category: 'fitness',
      });
    });

    it('should include archived when requested', async () => {
      cache.get.mockReturnValue(undefined);
      Habit.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });

      await habitService.getAll('user1', { includeArchived: true });
      expect(Habit.find).toHaveBeenCalledWith({ userId: 'user1' });
    });
  });

  describe('getById', () => {
    it('should return habit if found and authorized', async () => {
      const habit = { _id: 'h1', userId: { toString: () => 'user1' } };
      Habit.findById.mockResolvedValue(habit);

      const result = await habitService.getById('h1', 'user1');
      expect(result).toEqual(habit);
    });

    it('should throw 404 if habit not found', async () => {
      Habit.findById.mockResolvedValue(null);

      await expect(habitService.getById('h1', 'user1')).rejects.toMatchObject({
        message: 'Habit not found',
        statusCode: 404,
      });
    });

    it('should throw 403 if user not authorized', async () => {
      Habit.findById.mockResolvedValue({
        _id: 'h1',
        userId: { toString: () => 'otherUser' },
      });

      await expect(habitService.getById('h1', 'user1')).rejects.toMatchObject({
        message: 'Not authorized to access this habit',
        statusCode: 403,
      });
    });
  });

  describe('create', () => {
    it('should create habit with correct sortOrder', async () => {
      Habit.countDocuments.mockResolvedValue(3);
      const newHabit = { _id: 'h1', name: 'Read', userId: 'user1' };
      Habit.create.mockResolvedValue(newHabit);

      const result = await habitService.create('user1', { name: 'Read', type: 'boolean' });

      expect(Habit.create).toHaveBeenCalledWith({
        name: 'Read',
        type: 'boolean',
        userId: 'user1',
        sortOrder: 3,
      });
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:user1');
      expect(result).toEqual(newHabit);
    });
  });

  describe('update', () => {
    it('should update allowed fields and save', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        name: 'Old',
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(habit);

      const result = await habitService.update('h1', 'user1', {
        name: 'New Name',
        color: '#ff0000',
        userId: 'hacker', // should not be set
      });

      expect(habit.name).toBe('New Name');
      expect(habit.color).toBe('#ff0000');
      expect(habit.userId.toString()).toBe('user1'); // not overwritten
      expect(habit.save).toHaveBeenCalled();
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:user1');
    });

    it('should invalidate the owner cache when a shared admin updates a habit', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'owner1' },
        name: 'Original',
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(habit);
      sharedHabitService.getUserRoleForHabit.mockResolvedValue('admin');

      await habitService.update('h1', 'admin1', { name: 'Updated' });

      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:admin1');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:owner1');
    });
  });

  describe('archive', () => {
    it('should set isArchived to true', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        isArchived: false,
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(habit);
      SharedHabit.findOne.mockResolvedValue(null);

      await habitService.archive('h1', 'user1');
      expect(habit.isArchived).toBe(true);
      expect(habit.save).toHaveBeenCalled();
    });

    it('should reject archiving an active shared habit', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        isArchived: false,
        save: jest.fn(),
      };
      Habit.findById.mockResolvedValue(habit);
      SharedHabit.findOne.mockResolvedValue({ _id: 'sh1' });

      await expect(habitService.archive('h1', 'user1')).rejects.toMatchObject({
        message: 'Unshare the habit before archiving it',
        statusCode: 400,
      });
      expect(habit.save).not.toHaveBeenCalled();
    });
  });

  describe('unarchive', () => {
    it('should set isArchived to false', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
        isArchived: true,
        save: jest.fn().mockResolvedValue(true),
      };
      Habit.findById.mockResolvedValue(habit);

      await habitService.unarchive('h1', 'user1');
      expect(habit.isArchived).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete habit and associated logs', async () => {
      const habit = {
        _id: 'h1',
        userId: { toString: () => 'user1' },
      };
      Habit.findById.mockResolvedValue(habit);
      HabitLog.deleteMany.mockResolvedValue({ deletedCount: 5 });
      SharedHabit.findOneAndDelete.mockResolvedValue(true);
      Habit.findByIdAndDelete.mockResolvedValue(true);

      const result = await habitService.delete('h1', 'user1');

      expect(HabitLog.deleteMany).toHaveBeenCalledWith({ habitId: 'h1' });
      expect(Habit.findByIdAndDelete).toHaveBeenCalledWith('h1');
      expect(result.message).toBe('Habit and associated logs deleted');
    });
  });

  describe('reorder', () => {
    it('should reorder habits via bulkWrite', async () => {
      const items = [
        { id: 'h1', sortOrder: 0 },
        { id: 'h2', sortOrder: 1 },
      ];
      Habit.find.mockResolvedValue([{ _id: 'h1' }, { _id: 'h2' }]);
      Habit.bulkWrite.mockResolvedValue({});

      const result = await habitService.reorder('user1', items);

      expect(Habit.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: { _id: 'h1', userId: 'user1' }, update: { $set: { sortOrder: 0 } } } },
        { updateOne: { filter: { _id: 'h2', userId: 'user1' }, update: { $set: { sortOrder: 1 } } } },
      ]);
      expect(result.message).toBe('Habits reordered');
    });

    it('should throw 400 if some habits not found', async () => {
      Habit.find.mockResolvedValue([{ _id: 'h1' }]); // Only 1 found

      await expect(
        habitService.reorder('user1', [
          { id: 'h1', sortOrder: 0 },
          { id: 'h2', sortOrder: 1 },
        ])
      ).rejects.toMatchObject({
        message: 'Some habits not found or unauthorized',
        statusCode: 400,
      });
    });
  });
});

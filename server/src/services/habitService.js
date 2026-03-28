import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import SharedHabit from '../models/SharedHabit.js';
import AppError from '../utils/AppError.js';
import cache from './cacheService.js';
import sharedHabitService from './sharedHabitService.js';

class HabitService {
  _cacheKey(userId, opts = {}) {
    return `habits:${userId}:archived=${opts.includeArchived || false}:cat=${opts.category || 'all'}`;
  }

  async getAll(userId, { includeArchived = false, category } = {}) {
    const key = this._cacheKey(userId, { includeArchived, category });
    const cached = cache.get(key);
    if (cached) return cached;

    const filter = { userId };
    if (!includeArchived) {
      filter.isArchived = false;
    }
    if (category) {
      filter.category = category;
    }
    const habits = await Habit.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
    cache.set(key, habits, 120);
    return habits;
  }

  async getById(habitId, userId, { allowSharedAdmin = false } = {}) {
    const habit = await Habit.findById(habitId);
    if (!habit) {
      throw new AppError('Habit not found', 404);
    }
    if (habit.userId.toString() !== userId.toString()) {
      if (allowSharedAdmin) {
        const role = await sharedHabitService.getUserRoleForHabit(userId, habitId);
        if (role === 'admin') return habit;
      }
      throw new AppError('Not authorized to access this habit', 403);
    }
    return habit;
  }

  _invalidateCache(userId) {
    cache.delByPrefix(`habits:${userId}`);
  }

  async create(userId, data) {
    const allowedCreateFields = ['name', 'type', 'unit', 'target', 'color', 'icon', 'frequency', 'category'];
    const filtered = {};
    for (const field of allowedCreateFields) {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    }
    const count = await Habit.countDocuments({ userId, isArchived: false });
    const habit = await Habit.create({
      ...filtered,
      userId,
      sortOrder: count,
    });
    this._invalidateCache(userId);
    return habit;
  }

  async update(habitId, userId, data) {
    const habit = await this.getById(habitId, userId, { allowSharedAdmin: true });

    const allowedFields = ['name', 'type', 'unit', 'target', 'color', 'icon', 'frequency', 'sortOrder', 'category'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        habit[field] = data[field];
      }
    }

    await habit.save();
    this._invalidateCache(userId);
    // If a shared admin edited this, also invalidate the actual owner's cache
    if (habit.userId.toString() !== userId.toString()) {
      this._invalidateCache(habit.userId.toString());
    }
    return habit;
  }

  async archive(habitId, userId) {
    const habit = await this.getById(habitId, userId);
    const activeShare = await SharedHabit.findOne({ habitId: habit._id, isActive: true });
    if (activeShare) {
      throw new AppError('Unshare the habit before archiving it', 400);
    }
    habit.isArchived = true;
    await habit.save();
    this._invalidateCache(userId);
    return habit;
  }

  async unarchive(habitId, userId) {
    const habit = await this.getById(habitId, userId);
    habit.isArchived = false;
    await habit.save();
    this._invalidateCache(userId);
    return habit;
  }

  async delete(habitId, userId) {
    const habit = await this.getById(habitId, userId);
    await HabitLog.deleteMany({ habitId: habit._id });
    await SharedHabit.findOneAndDelete({ habitId: habit._id });
    await Habit.findByIdAndDelete(habit._id);
    this._invalidateCache(userId);
    return { message: 'Habit and associated logs deleted' };
  }

  async reorder(userId, items) {
    const ids = items.map((i) => i.id);
    const habits = await Habit.find({ _id: { $in: ids }, userId });
    if (habits.length !== ids.length) {
      throw new AppError('Some habits not found or unauthorized', 400);
    }

    const ops = items.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id, userId },
        update: { $set: { sortOrder } },
      },
    }));
    await Habit.bulkWrite(ops);
    this._invalidateCache(userId);
    return { message: 'Habits reordered' };
  }
}

export default new HabitService();

import mongoose from 'mongoose';
import HabitLog from '../models/HabitLog.js';
import Habit from '../models/Habit.js';
import AppError from '../utils/AppError.js';
import streakService from './streakService.js';
import {
  toUTCMidnight,
  getTodayUTC,
  daysBetween,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
  getDayOfWeek,
} from '../utils/dateHelpers.js';
import { MAX_BACKDATE_DAYS } from '../config/constants.js';

class LogService {
  async createOrUpdate(userId, { habitId, date, value, notes }) {
    if (!habitId || !date) {
      throw new AppError('habitId and date are required', 400);
    }

    const habit = await Habit.findById(habitId);
    if (!habit) {
      throw new AppError('Habit not found', 404);
    }
    // Authorization check — fail fast before any other logic
    if (habit.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorized to log this habit', 403);
    }

    const logDate = toUTCMidnight(date);
    const today = getTodayUTC();
    const diff = daysBetween(logDate, today);

    if (diff < 0) {
      throw new AppError('Cannot log for future dates', 400);
    }
    if (diff > MAX_BACKDATE_DAYS) {
      throw new AppError(`Cannot backdate more than ${MAX_BACKDATE_DAYS} days`, 400);
    }

    const result = await HabitLog.findOneAndUpdate(
      { habitId, date: logDate },
      { habitId, userId, date: logDate, value, notes: notes || '' },
      { upsert: true, new: true, runValidators: true, includeResultMetadata: true }
    );

    const isNew = !result.lastErrorObject.updatedExisting;
    const logDoc = result.value;

    await this.updateStreaks(habit);

    return { log: logDoc, isNew };
  }

  async updateStreaks(habit) {
    const logs = await HabitLog.find({ habitId: habit._id }).sort({ date: 1 });
    const { currentStreak, longestStreak } = streakService.calculateStreaks(
      logs,
      habit.frequency,
      habit.target,
      habit.createdAt
    );

    habit.currentStreak = currentStreak;
    habit.longestStreak = Math.max(longestStreak, habit.longestStreak);
    await habit.save();
  }

  async getDailyLogs(userId, dateString) {
    const date = toUTCMidnight(dateString);
    const dayOfWeek = getDayOfWeek(date);

    const habits = await Habit.find({
      userId,
      isArchived: false,
      frequency: { $in: [dayOfWeek] },
    }).sort({ sortOrder: 1, createdAt: -1 });

    const logs = await HabitLog.find({ userId, date });

    const logMap = new Map();
    for (const log of logs) {
      logMap.set(log.habitId.toString(), log);
    }

    const result = habits.map((habit) => {
      const log = logMap.get(habit._id.toString());
      return {
        habit: habit.toObject(),
        log: log || null,
        isCompleted: log
          ? typeof log.value === 'boolean'
            ? log.value
            : log.value >= habit.target
          : false,
      };
    });

    const completedCount = result.filter((r) => r.isCompleted).length;

    return {
      date: dateString,
      habits: result,
      total: result.length,
      completed: completedCount,
    };
  }

  async getRangeLogs(userId, startDate, endDate) {
    const start = toUTCMidnight(startDate);
    const end = toUTCMidnight(endDate);

    if (start > end) {
      throw new AppError('Start date must be before or equal to end date', 400);
    }

    const habits = await Habit.find({ userId, isArchived: false }).sort({ sortOrder: 1, createdAt: -1 });
    const logs = await HabitLog.find({
      userId,
      date: { $gte: start, $lte: end },
    });

    return { startDate, endDate, habits, logs };
  }

  async getMonthlyLogs(userId, month, year) {
    const startDate = getStartOfMonth(year, month);
    const endDate = getEndOfMonth(year, month);

    const habits = await Habit.find({ userId, isArchived: false });
    const logs = await HabitLog.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });

    return { month, year, habits, logs };
  }

  async getYearlyLogs(userId, year) {
    const startDate = getStartOfYear(year);
    const endDate = getEndOfYear(year);

    const habits = await Habit.find({ userId, isArchived: false });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const monthlyStats = await HabitLog.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$date' } },
          totalLogs: { $sum: 1 },
          completedLogs: {
            $sum: {
              $cond: [
                { $eq: ['$value', true] },
                1,
                { $cond: [{ $gte: ['$value', 1] }, 1, 0] },
              ],
            },
          },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]);

    const logs = await HabitLog.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });

    return { year, habits, monthlyStats, logs };
  }
}

export default new LogService();

import mongoose from 'mongoose';
import HabitLog from '../models/HabitLog.js';
import Habit from '../models/Habit.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import streakService from './streakService.js';
import sharedHabitService from './sharedHabitService.js';
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

    // Authorization check — owner or shared member/admin
    const isOwner = habit.userId.toString() === userId.toString();
    if (!isOwner) {
      const role = await sharedHabitService.getUserRoleForHabit(userId, habitId);
      if (!role) {
        throw new AppError('Not authorized to log this habit', 403);
      }
      if (role === 'viewer') {
        throw new AppError('Viewers cannot log shared habits', 403);
      }
      // admin or member — allowed to log
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

    // Check if log already exists to determine create vs update
    const existingLog = await HabitLog.findOne({ habitId, userId, date: logDate });
    const isNew = !existingLog;

    const log = await HabitLog.findOneAndUpdate(
      { habitId, userId, date: logDate },
      { habitId, userId, date: logDate, value, notes: notes || '' },
      { upsert: true, new: true, runValidators: true }
    );

    await this.updateStreaks(habit, userId);

    return { log, isNew };
  }

  async updateStreaks(habit, userId) {
    // For shared habits, calculate streaks per-user
    const query = userId ? { habitId: habit._id, userId } : { habitId: habit._id };
    const logs = await HabitLog.find(query).sort({ date: 1 });
    const { currentStreak, longestStreak } = streakService.calculateStreaks(
      logs,
      habit.frequency,
      habit.target,
      habit.createdAt
    );

    // Only update habit-level streaks for the owner
    if (!userId || habit.userId.toString() === userId.toString()) {
      habit.currentStreak = currentStreak;
      habit.longestStreak = Math.max(longestStreak, habit.longestStreak);
      await habit.save();
    }
  }

  async getDailyLogs(userId, dateString) {
    const date = toUTCMidnight(dateString);
    const dayOfWeek = getDayOfWeek(date);

    // Fetch user's own habits
    const ownHabits = await Habit.find({
      userId,
      isArchived: false,
      frequency: { $in: [dayOfWeek] },
    }).sort({ sortOrder: 1, createdAt: -1 });

    // Fetch shared habits the user is part of
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);

    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        isArchived: false,
        frequency: { $in: [dayOfWeek] },
      }).sort({ createdAt: -1 });
    }

    // Fetch owner names for shared habits
    const ownerIds = [...new Set(sharedEntries.map((e) => e.ownerId.toString()))];
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } }, 'name')
      : [];
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));

    // Build role map for shared habits
    const roleMap = new Map(
      sharedEntries.map((e) => [e.habitId.toString(), { role: e.role, ownerId: e.ownerId.toString() }])
    );

    // Fetch user's logs for this date (covers both own and shared habits)
    const logs = await HabitLog.find({ userId, date });
    const logMap = new Map();
    for (const log of logs) {
      logMap.set(log.habitId.toString(), log);
    }

    // Map own habits
    const ownResult = ownHabits.map((habit) => {
      const log = logMap.get(habit._id.toString());
      return {
        habit: habit.toObject(),
        log: log || null,
        isCompleted: log
          ? typeof log.value === 'boolean'
            ? log.value
            : log.value >= habit.target
          : false,
        isShared: false,
      };
    });

    // Map shared habits
    const sharedResult = sharedHabits.map((habit) => {
      const log = logMap.get(habit._id.toString());
      const info = roleMap.get(habit._id.toString());
      return {
        habit: habit.toObject(),
        log: log || null,
        isCompleted: log
          ? typeof log.value === 'boolean'
            ? log.value
            : log.value >= habit.target
          : false,
        isShared: true,
        sharedBy: ownerMap.get(info?.ownerId) || 'Unknown',
        myRole: info?.role || 'viewer',
      };
    });

    const result = [...ownResult, ...sharedResult];
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

    // Own habits
    const ownHabits = await Habit.find({ userId, isArchived: false }).sort({ sortOrder: 1, createdAt: -1 });

    // Shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        isArchived: false,
      }).sort({ createdAt: -1 });
    }

    // Owner names
    const ownerIds = [...new Set(sharedEntries.map((e) => e.ownerId.toString()))];
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } }, 'name')
      : [];
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));
    const roleMap = new Map(
      sharedEntries.map((e) => [e.habitId.toString(), { role: e.role, ownerId: e.ownerId.toString() }])
    );

    // Mark shared habits
    const markedSharedHabits = sharedHabits.map((h) => {
      const obj = h.toObject();
      const info = roleMap.get(h._id.toString());
      obj.isShared = true;
      obj.sharedBy = ownerMap.get(info?.ownerId) || 'Unknown';
      obj.myRole = info?.role || 'viewer';
      return obj;
    });

    const allHabits = [
      ...ownHabits.map((h) => ({ ...h.toObject(), isShared: false })),
      ...markedSharedHabits,
    ];

    // Fetch logs for all habits the user has logged
    const allHabitIds = allHabits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId,
      habitId: { $in: allHabitIds },
      date: { $gte: start, $lte: end },
    });

    return { startDate, endDate, habits: allHabits, logs };
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
                { $or: [{ $eq: ['$value', true] }, { $gte: ['$value', 1] }] },
                1,
                0,
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

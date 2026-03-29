import mongoose from 'mongoose';
import HabitLog from '../models/HabitLog.js';
import Habit from '../models/Habit.js';
import User from '../models/User.js';
import SharedHabit from '../models/SharedHabit.js';
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
  _getLoggedHabitIds(logs) {
    return [...new Set(logs.map((log) => log.habitId.toString()))];
  }

  _serializeHabit(habit, streakOverride = null) {
    const habitData = typeof habit.toObject === 'function' ? habit.toObject() : { ...habit };

    if (streakOverride) {
      habitData.currentStreak = streakOverride.currentStreak;
      habitData.longestStreak = streakOverride.longestStreak;
    }

    return habitData;
  }

  async _buildSharedStreakMap(userId, sharedHabits) {
    if (sharedHabits.length === 0) return new Map();

    const habitIds = sharedHabits.map((habit) => habit._id);
    const logs = await HabitLog.find({
      userId,
      habitId: { $in: habitIds },
    }).sort({ habitId: 1, date: 1 });

    const logsByHabit = new Map();
    for (const log of logs) {
      const key = log.habitId.toString();
      if (!logsByHabit.has(key)) {
        logsByHabit.set(key, []);
      }
      logsByHabit.get(key).push(log);
    }

    const streakMap = new Map();
    for (const habit of sharedHabits) {
      const habitLogs = logsByHabit.get(habit._id.toString()) || [];
      const streaks = streakService.calculateStreaks(
        habitLogs,
        habit.frequency,
        habit.target,
        habit.createdAt
      );
      streakMap.set(habit._id.toString(), streaks);
    }

    return streakMap;
  }

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
      console.log(`[Log] Shared habit auth: user=${userId}, habit=${habitId}, role=${role}`);
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

    const result = await HabitLog.findOneAndUpdate(
      { habitId, userId, date: logDate },
      { habitId, userId, date: logDate, value, notes: notes || '' },
      { upsert: true, new: true, runValidators: true, includeResultMetadata: true }
    );

    const isNew = !result.lastErrorObject.updatedExisting;
    const logDoc = result.value;

    // Don't let streak calculation errors fail the whole request
    try {
      await this.updateStreaks(habit, userId);
    } catch (err) {
      console.error('Streak update failed:', err.message);
    }

    return { log: logDoc, isNew };
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

  async getUserStreakForHabit(userId, habit) {
    const logs = await HabitLog.find({ habitId: habit._id, userId }).sort({ date: 1 });
    return streakService.calculateStreaks(logs, habit.frequency, habit.target, habit.createdAt);
  }

  async getDailyLogs(userId, dateString) {
    const date = toUTCMidnight(dateString);
    const dayOfWeek = getDayOfWeek(date);
    const logs = await HabitLog.find({ userId, date });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    // Fetch user's own habits
    const ownHabits = await Habit.find({
      userId,
      $or: [
        { isArchived: false, frequency: { $in: [dayOfWeek] } },
        { _id: { $in: loggedHabitIds } },
      ],
    }).sort({ sortOrder: 1, createdAt: -1 });

    // Fetch shared habits the user is part of
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);

    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        $or: [
          { isArchived: false, frequency: { $in: [dayOfWeek] } },
          { _id: { $in: loggedHabitIds } },
        ],
      }).sort({ createdAt: -1 });
    }

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits);

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

    const logMap = new Map();
    for (const log of logs) {
      logMap.set(log.habitId.toString(), log);
    }

    // Find which of the owner's own habits are shared
    const ownHabitIds = ownHabits.map((h) => h._id);
    const ownSharedDocs = await SharedHabit.find({
      habitId: { $in: ownHabitIds },
      ownerId: userId,
      isActive: true,
    }).select('habitId');
    const ownSharedSet = new Set(ownSharedDocs.map((s) => s.habitId.toString()));

    // Map own habits (mark shared ones)
    const ownResult = ownHabits.map((habit) => {
      const log = logMap.get(habit._id.toString());
      const habitIsShared = ownSharedSet.has(habit._id.toString());
      return {
        habit: this._serializeHabit(habit),
        log: log || null,
        isCompleted: log
          ? typeof log.value === 'boolean'
            ? log.value
            : log.value >= habit.target
          : false,
        isShared: habitIsShared,
        ...(habitIsShared && { myRole: 'owner' }),
      };
    });

    // Map shared habits (compute per-user streaks)
    const sharedResult = await Promise.all(sharedHabits.map(async (habit) => {
      const log = logMap.get(habit._id.toString());
      const info = roleMap.get(habit._id.toString());
      // Compute this user's personal streak for the shared habit
      let userStreak;
      try {
        userStreak = await this.getUserStreakForHabit(userId, habit);
      } catch {
        userStreak = { currentStreak: 0, longestStreak: 0 };
      }
      const habitObj = habit.toObject();
      habitObj.currentStreak = userStreak.currentStreak;
      habitObj.longestStreak = userStreak.longestStreak;
      return {
        habit: this._serializeHabit(habit, sharedStreakMap.get(habit._id.toString())),
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
    }));

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

    if (start > end) {
      throw new AppError('Start date must be before or equal to end date', 400);
    }

    const logs = await HabitLog.find({
      userId,
      date: { $gte: start, $lte: end },
    });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    // Own habits
    const ownHabits = await Habit.find({
      userId,
      $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
    }).sort({ sortOrder: 1, createdAt: -1 });

    // Shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
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

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits);

    // Mark shared habits
    const markedSharedHabits = sharedHabits.map((h) => {
      const obj = this._serializeHabit(h, sharedStreakMap.get(h._id.toString()));
      const info = roleMap.get(h._id.toString());
      obj.isShared = true;
      obj.sharedBy = ownerMap.get(info?.ownerId) || 'Unknown';
      obj.myRole = info?.role || 'viewer';
      return obj;
    });

    const allHabits = [
      ...ownHabits.map((h) => ({ ...this._serializeHabit(h), isShared: false })),
      ...markedSharedHabits,
    ];

    return { startDate, endDate, habits: allHabits, logs };
  }

  async getMonthlyLogs(userId, month, year) {
    const startDate = getStartOfMonth(year, month);
    const endDate = getEndOfMonth(year, month);
    const logs = await HabitLog.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    const ownHabits = await Habit.find({
      userId,
      $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
    });

    // Include shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
      });
    }

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits);
    const habits = [
      ...ownHabits.map((habit) => this._serializeHabit(habit)),
      ...sharedHabits.map((habit) => this._serializeHabit(habit, sharedStreakMap.get(habit._id.toString()))),
    ];

    return { month, year, habits, logs };
  }

  async getYearlyLogs(userId, year) {
    const startDate = getStartOfYear(year);
    const endDate = getEndOfYear(year);
    const logs = await HabitLog.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    const ownHabits = await Habit.find({
      userId,
      $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
    });

    // Include shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find({
        _id: { $in: sharedHabitIds },
        $or: [{ isArchived: false }, { _id: { $in: loggedHabitIds } }],
      });
    }

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits);
    const habits = [
      ...ownHabits.map((habit) => this._serializeHabit(habit)),
      ...sharedHabits.map((habit) => this._serializeHabit(habit, sharedStreakMap.get(habit._id.toString()))),
    ];
    const allHabitIds = habits.map((h) => h._id);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const monthlyStats = await HabitLog.aggregate([
      {
        $match: {
          userId: userObjectId,
          habitId: { $in: allHabitIds },
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

    const habitIdSet = new Set(allHabitIds.map((habitId) => habitId.toString()));
    const filteredLogs = logs.filter((log) => habitIdSet.has(log.habitId.toString()));

    return { year, habits, monthlyStats, logs: filteredLogs };
  }

  async getMembersProgress(requesterId, habitId, dateString) {
    const date = toUTCMidnight(dateString);

    // Get sharing info and verify permission
    const { shared, requesterRole } = await sharedHabitService.getSharingInfo(requesterId, habitId);

    const habit = await Habit.findById(habitId);
    if (!habit) throw new AppError('Habit not found', 404);

    // Build full member list: owner + accepted sharedWith members
    const ownerUser = await User.findById(shared.ownerId._id || shared.ownerId, 'name email avatar');
    const memberUserIds = shared.sharedWith
      .filter((m) => m.status === 'accepted')
      .map((m) => ({
        userId: m.userId._id || m.userId,
        role: m.role,
      }));

    // Fetch all logs for this habit + date (across all users)
    const logs = await HabitLog.find({ habitId, date });
    const logMap = new Map();
    for (const log of logs) {
      logMap.set(log.userId.toString(), log);
    }

    // Build member progress list
    const members = [];

    // Owner first
    if (ownerUser) {
      const ownerLog = logMap.get(ownerUser._id.toString());
      members.push({
        userId: ownerUser._id,
        name: ownerUser.name,
        avatar: ownerUser.avatar,
        role: 'owner',
        isOwner: true,
        value: ownerLog?.value ?? null,
        isCompleted: ownerLog
          ? typeof ownerLog.value === 'boolean'
            ? ownerLog.value
            : ownerLog.value >= habit.target
          : false,
      });
    }

    // Other members
    for (const member of memberUserIds) {
      const uid = member.userId.toString();
      // Get populated user data if available, otherwise fetch
      const populatedMember = shared.sharedWith.find(
        (m) => (m.userId._id || m.userId).toString() === uid && m.status === 'accepted'
      );
      const userInfo = populatedMember?.userId?.name
        ? populatedMember.userId
        : await User.findById(uid, 'name email avatar');

      if (!userInfo) continue;

      const memberLog = logMap.get(uid);
      members.push({
        userId: userInfo._id || uid,
        name: userInfo.name,
        avatar: userInfo.avatar,
        role: member.role,
        isOwner: false,
        value: memberLog?.value ?? null,
        isCompleted: memberLog
          ? typeof memberLog.value === 'boolean'
            ? memberLog.value
            : memberLog.value >= habit.target
          : false,
      });
    }

    const completedCount = members.filter((m) => m.isCompleted).length;

    return {
      habitId,
      habitName: habit.name,
      habitType: habit.type,
      target: habit.target,
      unit: habit.unit,
      date: dateString,
      members,
      completedCount,
      totalMembers: members.length,
    };
  }
}

export default new LogService();

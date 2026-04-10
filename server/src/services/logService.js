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
  getTodayInTimezone,
  daysBetween,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
  getDayOfWeek,
  toDateString,
} from '../utils/dateHelpers.js';
import { MAX_BACKDATE_DAYS, NOTIFICATION_TYPES, STREAK_MILESTONES } from '../config/constants.js';
import notificationService from './notificationService.js';
import emailService from './emailService.js';
import streakFreezeService from './streakFreezeService.js';

// Uses $and to combine the createdDate/createdAt filter with the active-or-logged filter,
// so neither collides with any $or/$and the caller may have in baseFilter.
function buildVisibleHabitQuery(baseFilter, cutoffDateStr, loggedHabitIds, activeFilter) {
  // For the legacy createdAt fallback, use $lt next-day-midnight so habits created
  // anytime on the cutoff day are included (createdAt can be e.g. 22:00 UTC).
  const nextDayMidnight = new Date(toUTCMidnight(cutoffDateStr).getTime() + 86400000);
  const { $or: baseOr, $and: baseAnd, ...rest } = baseFilter;
  const conditions = [
    { $or: [
      { createdDate: { $lte: cutoffDateStr } },
      { createdDate: { $exists: false }, createdAt: { $lt: nextDayMidnight } },
    ] },
    { $or: [activeFilter, { _id: { $in: loggedHabitIds } }] },
  ];
  if (baseOr) conditions.push({ $or: baseOr });
  if (baseAnd) conditions.push(...baseAnd);
  return { ...rest, $and: conditions };
}

function getUTCDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

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

  async _buildSharedStreakMap(userId, sharedHabits, timezone) {
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

    // Batch fetch frozen dates for all shared habits in one query
    const frozenDatesMap = await streakFreezeService.getFrozenDatesForUserHabits(userId, habitIds);

    const streakMap = new Map();
    for (const habit of sharedHabits) {
      const habitLogs = logsByHabit.get(habit._id.toString()) || [];
      const frozenDates = frozenDatesMap.get(habit._id.toString()) || new Set();
      const streaks = streakService.calculateStreaks(habitLogs, {
        frequency: habit.frequency,
        target: habit.target,
        habitCreatedAt: habit.createdAt,
        createdDate: habit.createdDate,
        timezone,
        frozenDates,
      });
      streakMap.set(habit._id.toString(), streaks);
    }

    return streakMap;
  }

  async createOrUpdate(userId, { habitId, date, value, notes }, timezone) {
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
    const habitCreatedDate = habit.createdDate || getUTCDateString(habit.createdAt);
    if (habitCreatedDate && date < habitCreatedDate) {
      throw new AppError('Cannot log before the habit was created', 400);
    }

    const result = await HabitLog.findOneAndUpdate(
      { habitId, userId, date: logDate },
      { habitId, userId, date: logDate, value, notes: notes || '' },
      { upsert: true, new: true, runValidators: true, includeResultMetadata: true }
    );

    const isNew = !result.lastErrorObject.updatedExisting;
    const logDoc = result.value;

    // Don't let streak calculation errors fail the whole request
    let streaks = null;
    try {
      streaks = await this.updateStreaks(habit, userId, timezone);
    } catch (err) {
      console.error('Streak update failed:', err.message);
    }

    // Fire-and-forget notifications — never block the response
    this._sendLogNotifications(userId, habit, value, isNew, streaks).catch(() => {});

    return { log: logDoc, isNew };
  }

  async updateStreaks(habit, userId, timezone) {
    // For shared habits, calculate streaks per-user
    const query = userId ? { habitId: habit._id, userId } : { habitId: habit._id };
    const logs = await HabitLog.find(query).sort({ date: 1 });
    const effectiveUserId = userId || habit.userId;
    const frozenDates = await streakFreezeService.getFrozenDatesForHabit(effectiveUserId, habit._id);
    const { currentStreak, longestStreak } = streakService.calculateStreaks(logs, {
      frequency: habit.frequency,
      target: habit.target,
      habitCreatedAt: habit.createdAt,
      createdDate: habit.createdDate,
      timezone,
      frozenDates,
    });

    // Only update habit-level streaks for the owner
    if (!userId || habit.userId.toString() === userId.toString()) {
      habit.currentStreak = currentStreak;
      habit.longestStreak = Math.max(longestStreak, habit.longestStreak);
      await habit.save();
    }

    return { currentStreak, longestStreak };
  }

  async getUserStreakForHabit(userId, habit, timezone) {
    const logs = await HabitLog.find({ habitId: habit._id, userId }).sort({ date: 1 });
    const frozenDates = await streakFreezeService.getFrozenDatesForHabit(userId, habit._id);
    return streakService.calculateStreaks(logs, {
      frequency: habit.frequency,
      target: habit.target,
      habitCreatedAt: habit.createdAt,
      createdDate: habit.createdDate,
      timezone,
      frozenDates,
    });

  async _sendLogNotifications(userId, habit, value, isNew, streaks) {
    const isCompleted = typeof value === 'boolean' ? value === true : value >= habit.target;

    // 1. Streak milestone notification
    if (streaks && STREAK_MILESTONES.includes(streaks.currentStreak)) {
      notificationService.send(userId, NOTIFICATION_TYPES.STREAK_MILESTONE, {
        pushPayload: {
          title: `${streaks.currentStreak}-day streak! \u{1F525}`,
          body: `You've completed "${habit.name}" for ${streaks.currentStreak} days in a row! Keep it up!`,
          icon: '/pwa-192x192.png',
          tag: `streak-${habit._id}`,
          data: { url: '/' },
        },
        emailFn: (user) =>
          emailService.sendStreakMilestoneEmail(user.email, user.name, habit.name, streaks.currentStreak),
      }).catch(() => {});
    }

    // 2. Goal completion notification (only for count-type habits on first completion)
    if (isCompleted && isNew && habit.type === 'count') {
      const bodyText = habit.type === 'count' && habit.unit
        ? `You completed "${habit.name}" today \u2014 ${value} ${habit.unit} done!`
        : `You completed "${habit.name}" today!`;

      notificationService.send(userId, NOTIFICATION_TYPES.GOAL_COMPLETION, {
        pushPayload: {
          title: 'Goal achieved! \u2705',
          body: bodyText,
          icon: '/pwa-192x192.png',
          tag: `goal-${habit._id}`,
          data: { url: '/' },
        },
        emailFn: (user) =>
          emailService.sendGoalCompletionEmail(user.email, user.name, habit.name, value, habit.target, habit.unit),
      }).catch(() => {});
    }

    // 3. Shared habit partner completed notification
    if (isCompleted) {
      SharedHabit.findOne({ habitId: habit._id, isActive: true })
        .then(async (shared) => {
          if (!shared) return;

          const logger = await User.findById(userId, 'name');
          if (!logger) return;

          // Collect all participants except the logger
          const recipientIds = [
            shared.ownerId.toString(),
            ...shared.sharedWith
              .filter((m) => m.status === 'accepted')
              .map((m) => m.userId.toString()),
          ].filter((id) => id !== userId.toString());

          for (const recipientId of recipientIds) {
            notificationService.send(recipientId, NOTIFICATION_TYPES.SHARED_ACTIVITY, {
              pushPayload: {
                title: 'Partner completed a habit!',
                body: `${logger.name} completed "${habit.name}" today`,
                icon: '/pwa-192x192.png',
                tag: `shared-activity-${habit._id}`,
                data: { url: '/' },
              },
              emailFn: null,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  async getDailyLogs(userId, dateString, timezone) {
    const date = toUTCMidnight(dateString);
    const dayOfWeek = getDayOfWeek(date);

    // Phase 1: Parallel — fetch logs and shared entries
    const [logs, sharedEntries] = await Promise.all([
      HabitLog.find({ userId, date }),
      sharedHabitService.getSharedHabitIdsForUser(userId),
    ]);

    const loggedHabitIds = this._getLoggedHabitIds(logs);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    const ownerIds = [...new Set(sharedEntries.map((e) => e.ownerId.toString()))];

    // Phase 2: Parallel — fetch own habits, shared habits, owner names, and own shared docs
    const [ownHabits, sharedHabits, owners] = await Promise.all([
      Habit.find(
        buildVisibleHabitQuery(
          { userId },
          dateString,
          loggedHabitIds,
          { isArchived: false, frequency: { $in: [dayOfWeek] } }
        )
      ).sort({ sortOrder: 1, createdAt: -1 }),
      sharedHabitIds.length > 0
        ? Habit.find(
            buildVisibleHabitQuery(
              { _id: { $in: sharedHabitIds } },
              dateString,
              loggedHabitIds,
              { isArchived: false, frequency: { $in: [dayOfWeek] } }
            )
          ).sort({ createdAt: -1 })
        : [],
      ownerIds.length > 0
        ? User.find({ _id: { $in: ownerIds } }, 'name')
        : [],
    ]);

    // Phase 3: Parallel — streaks and own shared docs (both depend on Phase 2 results)
    const ownHabitIds = ownHabits.map((h) => h._id);
    const [sharedStreakMap, ownSharedDocs] = await Promise.all([
      this._buildSharedStreakMap(userId, sharedHabits, timezone),
      SharedHabit.find({
        habitId: { $in: ownHabitIds },
        ownerId: userId,
        isActive: true,
      }).select('habitId'),
    ]);

    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));
    const roleMap = new Map(
      sharedEntries.map((e) => [e.habitId.toString(), { role: e.role, ownerId: e.ownerId.toString() }])
    );
    const logMap = new Map();
    for (const log of logs) {
      logMap.set(log.habitId.toString(), log);
    }
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

    // Map shared habits (use pre-built per-user streak map)
    const sharedResult = sharedHabits.map((habit) => {
      const log = logMap.get(habit._id.toString());
      const info = roleMap.get(habit._id.toString());
      const userStreak = sharedStreakMap.get(habit._id.toString());
      return {
        habit: this._serializeHabit(habit, userStreak),
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

  async getRangeLogs(userId, startDate, endDate, timezone) {
    const start = toUTCMidnight(startDate);
    const end = toUTCMidnight(endDate);

    if (start > end) {
      throw new AppError('Start date must be before or equal to end date', 400);
    }

    const logs = await HabitLog.find({ userId, date: { $gte: start, $lte: end } });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    // Own habits
    const ownHabits = await Habit.find(
      buildVisibleHabitQuery({ userId }, endDate, loggedHabitIds, { isArchived: false })
    ).sort({ sortOrder: 1, createdAt: -1 });

    // Shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find(
        buildVisibleHabitQuery(
          { _id: { $in: sharedHabitIds } },
          endDate,
          loggedHabitIds,
          { isArchived: false }
        )
      ).sort({ createdAt: -1 });
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

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits, timezone);

    // Find which of the owner's own habits are shared
    const ownHabitIds = ownHabits.map((h) => h._id);
    const ownSharedDocs = await SharedHabit.find({
      habitId: { $in: ownHabitIds },
      ownerId: userId,
      isActive: true,
    }).select('habitId');
    const ownSharedSet = new Set(ownSharedDocs.map((s) => s.habitId.toString()));

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
      ...ownHabits.map((h) => {
        const obj = { ...this._serializeHabit(h) };
        const habitIsShared = ownSharedSet.has(h._id.toString());
        obj.isShared = habitIsShared;
        if (habitIsShared) obj.myRole = 'owner';
        return obj;
      }),
      ...markedSharedHabits,
    ];

    return { startDate, endDate, habits: allHabits, logs };
  }

  async getMonthlyLogs(userId, month, year, timezone) {
    const startDate = getStartOfMonth(year, month);
    const endDate = getEndOfMonth(year, month);
    const endDateStr = toDateString(endDate);
    const logs = await HabitLog.find({ userId, date: { $gte: startDate, $lte: endDate } });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    const ownHabits = await Habit.find(
      buildVisibleHabitQuery({ userId }, endDateStr, loggedHabitIds, { isArchived: false })
    );

    // Include shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find(
        buildVisibleHabitQuery(
          { _id: { $in: sharedHabitIds } },
          endDateStr,
          loggedHabitIds,
          { isArchived: false }
        )
      );
    }

    // Build owner map and role map for shared habits
    const ownerIds = [...new Set(sharedEntries.map((e) => e.ownerId.toString()))];
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } }, 'name')
      : [];
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));
    const roleMap = new Map(
      sharedEntries.map((e) => [e.habitId.toString(), { role: e.role, ownerId: e.ownerId.toString() }])
    );

    // Find which of the owner's own habits are shared
    const ownHabitIds = ownHabits.map((h) => h._id);
    const ownSharedDocs = await SharedHabit.find({
      habitId: { $in: ownHabitIds },
      ownerId: userId,
      isActive: true,
    }).select('habitId');
    const ownSharedSet = new Set(ownSharedDocs.map((s) => s.habitId.toString()));

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits, timezone);
    const habits = [
      ...ownHabits.map((habit) => {
        const h = this._serializeHabit(habit);
        const habitIsShared = ownSharedSet.has(habit._id.toString());
        if (habitIsShared) {
          h.isShared = true;
          h.myRole = 'owner';
        }
        return h;
      }),
      ...sharedHabits.map((habit) => {
        const info = roleMap.get(habit._id.toString());
        const h = this._serializeHabit(habit, sharedStreakMap.get(habit._id.toString()));
        h.isShared = true;
        h.sharedBy = ownerMap.get(info?.ownerId) || 'Unknown';
        h.myRole = info?.role || 'viewer';
        return h;
      }),
    ];

    return { month, year, habits, logs };
  }

  async getYearlyLogs(userId, year, timezone) {
    const startDate = getStartOfYear(year);
    const endDate = getEndOfYear(year);
    const endDateStr = toDateString(endDate);
    const logs = await HabitLog.find({ userId, date: { $gte: startDate, $lte: endDate } });
    const loggedHabitIds = this._getLoggedHabitIds(logs);

    const ownHabits = await Habit.find(
      buildVisibleHabitQuery({ userId }, endDateStr, loggedHabitIds, { isArchived: false })
    );

    // Include shared habits
    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((e) => e.habitId);
    let sharedHabits = [];
    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find(
        buildVisibleHabitQuery(
          { _id: { $in: sharedHabitIds } },
          endDateStr,
          loggedHabitIds,
          { isArchived: false }
        )
      );
    }

    // Build owner map and role map for shared habits
    const ownerIds = [...new Set(sharedEntries.map((e) => e.ownerId.toString()))];
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } }, 'name')
      : [];
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));
    const roleMap = new Map(
      sharedEntries.map((e) => [e.habitId.toString(), { role: e.role, ownerId: e.ownerId.toString() }])
    );

    // Find which of the owner's own habits are shared
    const ownHabitIds = ownHabits.map((h) => h._id);
    const ownSharedDocs = await SharedHabit.find({
      habitId: { $in: ownHabitIds },
      ownerId: userId,
      isActive: true,
    }).select('habitId');
    const ownSharedSet = new Set(ownSharedDocs.map((s) => s.habitId.toString()));

    const sharedStreakMap = await this._buildSharedStreakMap(userId, sharedHabits, timezone);
    const habits = [
      ...ownHabits.map((habit) => {
        const h = this._serializeHabit(habit);
        const habitIsShared = ownSharedSet.has(habit._id.toString());
        if (habitIsShared) {
          h.isShared = true;
          h.myRole = 'owner';
        }
        return h;
      }),
      ...sharedHabits.map((habit) => {
        const info = roleMap.get(habit._id.toString());
        const h = this._serializeHabit(habit, sharedStreakMap.get(habit._id.toString()));
        h.isShared = true;
        h.sharedBy = ownerMap.get(info?.ownerId) || 'Unknown';
        h.myRole = info?.role || 'viewer';
        return h;
      }),
    ];
    const habitMap = new Map(habits.map((h) => [h._id.toString(), h]));
    const allHabitIds = habits.map((h) => h._id);

    const habitIdSet = new Set(allHabitIds.map((habitId) => habitId.toString()));
    const filteredLogs = logs.filter((log) => habitIdSet.has(log.habitId.toString()));

    // Compute monthlyStats in JS so we can compare each log against
    // its habit's actual target (the old aggregation used a hardcoded >= 1).
    const monthBuckets = new Map();
    for (const log of filteredLogs) {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date);
      const month = logDate.getUTCMonth() + 1;
      if (!monthBuckets.has(month)) {
        monthBuckets.set(month, { totalLogs: 0, completedLogs: 0 });
      }
      const bucket = monthBuckets.get(month);
      bucket.totalLogs++;
      const habit = habitMap.get(log.habitId.toString());
      if (habit) {
        const done = typeof log.value === 'boolean'
          ? log.value === true
          : log.value >= (habit.target ?? 1);
        if (done) bucket.completedLogs++;
      }
    }
    const monthlyStats = [...monthBuckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, stats]) => ({ _id: { month }, ...stats }));

    return { year, habits, monthlyStats, logs: filteredLogs };
  }

  async getLeaderboard(requesterId, habitId, range = 'week', timezone = null) {
    const { shared } = await sharedHabitService.getSharingInfo(requesterId, habitId);

    const habit = await Habit.findById(habitId);
    if (!habit) throw new AppError('Habit not found', 404);

    const today = timezone ? getTodayInTimezone(timezone) : getTodayUTC();
    const days = range === 'month' ? 30 : 7;
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

    // Build member list: owner + accepted members
    const ownerIdStr = (shared.ownerId._id || shared.ownerId).toString();
    const memberInfos = [{ userId: ownerIdStr, role: 'owner' }];
    for (const m of shared.sharedWith) {
      if (m.status === 'accepted') {
        memberInfos.push({
          userId: (m.userId._id || m.userId).toString(),
          role: m.role,
        });
      }
    }
    const allUserIds = memberInfos.map((m) => m.userId);

    // Fetch all logs in range
    const logs = await HabitLog.find({
      habitId,
      userId: { $in: allUserIds },
      date: { $gte: startDate, $lte: today },
    }).sort({ date: 1 });

    // Group logs by userId
    const logsByUser = new Map();
    for (const log of logs) {
      const uid = log.userId.toString();
      if (!logsByUser.has(uid)) logsByUser.set(uid, []);
      logsByUser.get(uid).push(log);
    }

    // Calculate scheduled days in range
    let scheduledDays = 0;
    const cursor = new Date(startDate);
    while (cursor <= today) {
      if (habit.frequency.includes(getDayOfWeek(cursor))) {
        scheduledDays++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Fetch user details and frozen dates in parallel
    const [users, frozenDatesMap] = await Promise.all([
      User.find({ _id: { $in: allUserIds } }, 'name avatar'),
      streakFreezeService.getFrozenDatesForHabits(allUserIds, habitId),
    ]);
    const userMap = new Map();
    for (const u of users) userMap.set(u._id.toString(), u);

    // Build leaderboard entries
    const entries = memberInfos.map((member) => {
      const userLogs = logsByUser.get(member.userId) || [];
      const completedCount = userLogs.filter((log) =>
        typeof log.value === 'boolean' ? log.value : log.value >= habit.target
      ).length;
      const completionRate = scheduledDays > 0 ? Math.round((completedCount / scheduledDays) * 100) : 0;

      // Calculate streak (include frozenDates and timezone for consistency)
      const allUserLogs = logsByUser.get(member.userId) || [];
      const frozenDates = frozenDatesMap.get(member.userId) || new Set();
      const { currentStreak } = streakService.calculateStreaks(allUserLogs, {
        frequency: habit.frequency,
        target: habit.target,
        habitCreatedAt: habit.createdAt,
        createdDate: habit.createdDate,
        timezone,
        frozenDates,
      });

      const user = userMap.get(member.userId);
      return {
        userId: member.userId,
        name: user?.name || 'Unknown',
        avatar: user?.avatar || null,
        role: member.role,
        completedCount,
        scheduledDays,
        completionRate,
        currentStreak,
      };
    });

    // Sort by completion rate desc, then streak desc
    entries.sort((a, b) => b.completionRate - a.completionRate || b.currentStreak - a.currentStreak);

    // Add rank
    entries.forEach((entry, i) => { entry.rank = i + 1; });

    return {
      habitId,
      habitName: habit.name,
      range,
      entries,
    };
  }

  async getMembersProgress(requesterId, habitId, dateString) {
    const date = toUTCMidnight(dateString);

    // Get sharing info and verify permission
    const { shared, requesterRole } = await sharedHabitService.getSharingInfo(requesterId, habitId);

    const habit = await Habit.findById(habitId);
    if (!habit) throw new AppError('Habit not found', 404);

    // Build full member list: owner + accepted sharedWith members
    const ownerUser = await User.findById(shared.ownerId._id || shared.ownerId, 'name avatar');
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

    // Other members — batch fetch any unpopulated users
    const populatedMap = new Map();
    const unpopulatedIds = [];
    for (const member of memberUserIds) {
      const uid = member.userId.toString();
      const populatedMember = shared.sharedWith.find(
        (m) => (m.userId._id || m.userId).toString() === uid && m.status === 'accepted'
      );
      if (populatedMember?.userId?.name) {
        populatedMap.set(uid, populatedMember.userId);
      } else {
        unpopulatedIds.push(uid);
      }
    }
    if (unpopulatedIds.length > 0) {
      const fetched = await User.find({ _id: { $in: unpopulatedIds } }, 'name avatar');
      for (const u of fetched) {
        populatedMap.set(u._id.toString(), u);
      }
    }

    for (const member of memberUserIds) {
      const uid = member.userId.toString();
      const userInfo = populatedMap.get(uid);
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

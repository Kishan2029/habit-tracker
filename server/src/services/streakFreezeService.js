import StreakFreeze from '../models/StreakFreeze.js';
import User from '../models/User.js';
import Habit from '../models/Habit.js';
import AppError from '../utils/AppError.js';

class StreakFreezeService {
  async useFreeze(userId, habitId, dateStr) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (!user.settings?.streakFreeze?.enabled) {
      throw new AppError('Streak freeze is not enabled. Enable it in settings.', 400);
    }

    const habit = await Habit.findById(habitId);
    if (!habit) throw new AppError('Habit not found', 404);
    if (habit.userId.toString() !== userId.toString()) {
      throw new AppError('You can only freeze your own habits', 403);
    }

    const month = dateStr.slice(0, 7); // YYYY-MM
    const allowedPerMonth = user.settings.streakFreeze.allowedPerMonth || 2;

    // Check monthly usage (per-habit)
    const usedThisMonth = await StreakFreeze.countDocuments({ userId, habitId, month });
    if (usedThisMonth >= allowedPerMonth) {
      throw new AppError(`Monthly freeze limit reached for this habit (${allowedPerMonth}/${allowedPerMonth} used)`, 400);
    }

    // Check if already frozen
    const existing = await StreakFreeze.findOne({ userId, habitId, date: dateStr });
    if (existing) {
      throw new AppError('This day is already frozen', 400);
    }

    await StreakFreeze.create({ userId, habitId, date: dateStr, month });

    return { frozenDate: dateStr, usedThisMonth: usedThisMonth + 1, allowedPerMonth };
  }

  async getFreezeStatus(userId, habitId) {
    const user = await User.findById(userId);
    const enabled = user?.settings?.streakFreeze?.enabled || false;
    const allowedPerMonth = user?.settings?.streakFreeze?.allowedPerMonth || 2;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usedThisMonth = await StreakFreeze.countDocuments({ userId, habitId, month: currentMonth });

    const freezes = await StreakFreeze.find({ userId, habitId }).sort({ date: -1 }).limit(30);
    const frozenDates = freezes.map((f) => f.date);

    return { enabled, usedThisMonth, allowedPerMonth, frozenDates };
  }

  async getFrozenDatesForHabit(userId, habitId) {
    // Limit to last 365 days to avoid unbounded growth
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const freezes = await StreakFreeze.find({ userId, habitId, date: { $gte: cutoffStr } });
    return new Set(freezes.map((f) => f.date));
  }

  /**
   * Batch freeze status for multiple habits (single user).
   * Returns Map<habitId, { frozenDates: string[] }>.
   */
  async getBatchFreezeStatus(userId, habitIds) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const freezes = await StreakFreeze.find({
      userId,
      habitId: { $in: habitIds },
      date: { $gte: cutoffStr },
    });
    const map = {};
    for (const hid of habitIds) {
      map[hid.toString()] = { frozenDates: [] };
    }
    for (const f of freezes) {
      const hid = f.habitId.toString();
      if (map[hid]) map[hid].frozenDates.push(f.date);
    }
    return map;
  }

  /**
   * Batch fetch frozen dates for multiple users on a single habit.
   * Returns Map<userId, Set<dateStr>>.
   */
  async getFrozenDatesForHabits(userIds, habitId) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const freezes = await StreakFreeze.find({
      userId: { $in: userIds },
      habitId,
      date: { $gte: cutoffStr },
    });
    const map = new Map();
    for (const f of freezes) {
      const uid = f.userId.toString();
      if (!map.has(uid)) map.set(uid, new Set());
      map.get(uid).add(f.date);
    }
    return map;
  }

  /**
   * Batch fetch frozen dates for a single user across multiple habits.
   * Returns Map<habitId, Set<dateStr>>.
   */
  async getFrozenDatesForUserHabits(userId, habitIds) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const freezes = await StreakFreeze.find({
      userId,
      habitId: { $in: habitIds },
      date: { $gte: cutoffStr },
    });
    const map = new Map();
    for (const f of freezes) {
      const hid = f.habitId.toString();
      if (!map.has(hid)) map.set(hid, new Set());
      map.get(hid).add(f.date);
    }
    return map;
  }
}

export default new StreakFreezeService();

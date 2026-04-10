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

    // Check monthly usage
    const usedThisMonth = await StreakFreeze.countDocuments({ userId, month });
    if (usedThisMonth >= allowedPerMonth) {
      throw new AppError(`Monthly freeze limit reached (${allowedPerMonth}/${allowedPerMonth} used)`, 400);
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
    const usedThisMonth = await StreakFreeze.countDocuments({ userId, month: currentMonth });

    const freezes = await StreakFreeze.find({ userId, habitId }).sort({ date: -1 }).limit(30);
    const frozenDates = freezes.map((f) => f.date);

    return { enabled, usedThisMonth, allowedPerMonth, frozenDates };
  }

  async getFrozenDatesForHabit(userId, habitId) {
    const freezes = await StreakFreeze.find({ userId, habitId });
    return new Set(freezes.map((f) => f.date));
  }
}

export default new StreakFreezeService();

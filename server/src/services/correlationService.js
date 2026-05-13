import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import AppError from '../utils/AppError.js';
import cache from './cacheService.js';
import {
  toDateString,
  addDays,
  getTodayUTC,
  getTodayInTimezone,
  getDayOfWeek,
} from '../utils/dateHelpers.js';
import {
  INSIGHTS_DEFAULT_WINDOW_DAYS,
  INSIGHTS_MIN_OVERLAP_DAYS,
  INSIGHTS_MIN_COMPLETED_DAYS,
  INSIGHTS_MIN_LIFT_PP,
  INSIGHTS_MIN_WINDOW_DAYS,
  INSIGHTS_MAX_WINDOW_DAYS,
  INSIGHTS_CACHE_TTL_SECONDS,
} from '../config/constants.js';

/**
 * Habit correlation analytics.
 *
 * For each ordered pair of non-archived habits (A, B), this service computes:
 *   P(B completed | A completed)  vs  P(B completed | A not completed)
 * scoped to the days where BOTH habits are scheduled (frequency overlap)
 * within the requested window.
 *
 * The "lift" is the difference in percentage points. Pairs are filtered by:
 *   - minimum overlap days (statistical noise floor)
 *   - minimum sample size in both the "A completed" and "A not completed" groups
 *   - minimum absolute lift (signal threshold)
 *
 * Math note: we use conditional probability rather than a proper coefficient
 * (Pearson / phi) because the UI renders it as a sentence, and "75% vs 30%" is
 * far easier to interpret than "phi = 0.42". If we ever need a single scalar
 * for cross-pair ranking, replace _computeDirectional and surface phi alongside.
 *
 * Day-of-week comes from getUTCDay() on the stored log.date (UTC midnight of
 * the user's local date). This matches the convention in streakService.
 */
class CorrelationService {
  _cacheKey(userId, windowDays) {
    return `insights:${userId}:${windowDays}`;
  }

  _emptyResult(windowDays, reason) {
    return {
      windowDays,
      guards: {
        minOverlapDays: INSIGHTS_MIN_OVERLAP_DAYS,
        minCompletedDays: INSIGHTS_MIN_COMPLETED_DAYS,
        minLiftPp: INSIGHTS_MIN_LIFT_PP,
      },
      insights: [],
      reason: reason || null,
    };
  }

  _invalidateCache(userId) {
    cache.delByPrefix(`insights:${userId}`);
  }

  async getInsights(userId, { windowDays = INSIGHTS_DEFAULT_WINDOW_DAYS, timezone = null } = {}) {
    if (
      !Number.isInteger(windowDays) ||
      windowDays < INSIGHTS_MIN_WINDOW_DAYS ||
      windowDays > INSIGHTS_MAX_WINDOW_DAYS
    ) {
      throw new AppError(
        `windowDays must be an integer between ${INSIGHTS_MIN_WINDOW_DAYS} and ${INSIGHTS_MAX_WINDOW_DAYS}`,
        400
      );
    }

    const cacheKey = this._cacheKey(userId, windowDays);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const habits = await Habit.find({ userId, isArchived: false })
      .select('_id name icon color frequency type target')
      .lean();

    if (habits.length < 2) {
      const empty = this._emptyResult(windowDays, 'need_more_habits');
      cache.set(cacheKey, empty, INSIGHTS_CACHE_TTL_SECONDS);
      return empty;
    }

    const today = timezone ? getTodayInTimezone(timezone) : getTodayUTC();
    const start = addDays(today, -(windowDays - 1));

    const habitIds = habits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId,
      habitId: { $in: habitIds },
      date: { $gte: start, $lte: today },
    })
      .select('habitId date value')
      .lean();

    // habitId(string) -> Set<dateString> of days where habit was completed
    const completedSets = new Map();
    for (const habit of habits) {
      completedSets.set(habit._id.toString(), new Set());
    }
    const habitById = new Map(habits.map((h) => [h._id.toString(), h]));

    for (const log of logs) {
      const key = log.habitId.toString();
      const habit = habitById.get(key);
      if (!habit) continue;
      const isCompleted =
        typeof log.value === 'boolean' ? log.value === true : log.value >= habit.target;
      if (isCompleted) {
        completedSets.get(key).add(toDateString(log.date));
      }
    }

    const insights = [];
    for (let i = 0; i < habits.length; i++) {
      for (let j = 0; j < habits.length; j++) {
        if (i === j) continue;
        const insight = this._computeDirectional(habits[i], habits[j], completedSets, start, today);
        if (insight) insights.push(insight);
      }
    }

    // Strongest signal first, regardless of direction (boosters and trade-offs both rank by magnitude).
    insights.sort((a, b) => Math.abs(b.liftPp) - Math.abs(a.liftPp));

    const result = {
      windowDays,
      guards: {
        minOverlapDays: INSIGHTS_MIN_OVERLAP_DAYS,
        minCompletedDays: INSIGHTS_MIN_COMPLETED_DAYS,
        minLiftPp: INSIGHTS_MIN_LIFT_PP,
      },
      insights,
      reason: insights.length === 0 ? 'no_pairs_pass_guards' : null,
    };
    cache.set(cacheKey, result, INSIGHTS_CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Compute the directional insight "from → to" for a single ordered habit pair.
   * Returns null if any guard fails.
   */
  _computeDirectional(from, to, completedSets, start, today) {
    const fromCompleted = completedSets.get(from._id.toString());
    const toCompleted = completedSets.get(to._id.toString());

    let overlapDays = 0;
    let fromDoneCount = 0;
    let fromMissedCount = 0;
    let toDoneGivenFromDone = 0;
    let toDoneGivenFromMissed = 0;

    let cursor = new Date(start);
    while (cursor <= today) {
      const dow = getDayOfWeek(cursor);
      if (from.frequency.includes(dow) && to.frequency.includes(dow)) {
        overlapDays++;
        const dateStr = toDateString(cursor);
        const fromDone = fromCompleted.has(dateStr);
        const toDone = toCompleted.has(dateStr);
        if (fromDone) {
          fromDoneCount++;
          if (toDone) toDoneGivenFromDone++;
        } else {
          fromMissedCount++;
          if (toDone) toDoneGivenFromMissed++;
        }
      }
      cursor = addDays(cursor, 1);
    }

    if (overlapDays < INSIGHTS_MIN_OVERLAP_DAYS) return null;
    if (fromDoneCount < INSIGHTS_MIN_COMPLETED_DAYS) return null;
    if (fromMissedCount < INSIGHTS_MIN_COMPLETED_DAYS) return null;

    const rateGivenDone = toDoneGivenFromDone / fromDoneCount;
    const rateGivenMissed = toDoneGivenFromMissed / fromMissedCount;
    const liftPp = Math.round((rateGivenDone - rateGivenMissed) * 100);

    if (Math.abs(liftPp) < INSIGHTS_MIN_LIFT_PP) return null;

    return {
      from: {
        _id: from._id,
        name: from.name,
        icon: from.icon,
        color: from.color,
      },
      to: {
        _id: to._id,
        name: to.name,
        icon: to.icon,
        color: to.color,
      },
      overlapDays,
      fromDoneCount,
      fromMissedCount,
      rateGivenDone: Number(rateGivenDone.toFixed(3)),
      rateGivenMissed: Number(rateGivenMissed.toFixed(3)),
      liftPp,
    };
  }
}

export default new CorrelationService();

import {
  toDateString,
  addDays,
  getTodayUTC,
  getTodayInTimezone,
  getDayOfWeek,
} from "../utils/dateHelpers.js";

class StreakService {
  calculateStreaks(logs, { frequency, target, habitCreatedAt, createdDate, timezone } = {}) {
    const completedSet = new Set();

    for (const log of logs) {
      const isCompleted =
        typeof log.value === "boolean"
          ? log.value === true
          : log.value >= target;
      if (isCompleted) {
        completedSet.add(toDateString(log.date));
      }
    }

    const today = timezone ? getTodayInTimezone(timezone) : getTodayUTC();
    // Prefer createdDate (local YYYY-MM-DD) over createdAt (UTC timestamp)
    const creationDate = createdDate
      ? new Date(`${createdDate}T00:00:00.000Z`)
      : new Date(habitCreatedAt);
    creationDate.setUTCHours(0, 0, 0, 0);

    // Use the earliest log date if it's before creation (handles backdated logs)
    let startDate = new Date(creationDate);
    if (logs.length > 0) {
      const earliestLog = new Date(logs[0].date); // logs are sorted by date asc
      earliestLog.setUTCHours(0, 0, 0, 0);
      if (earliestLog < startDate) {
        startDate = earliestLog;
      }
    }

    // Don't go beyond today
    if (startDate > today) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const scheduledDates = [];
    let current = new Date(startDate);

    while (current <= today) {
      const dayOfWeek = getDayOfWeek(current);
      if (frequency.includes(dayOfWeek)) {
        scheduledDates.push(toDateString(current));
      }
      current = addDays(current, 1);
    }

    if (scheduledDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Forward pass for longest streak
    let longestStreak = 0;
    let tempStreak = 0;

    for (const dateStr of scheduledDates) {
      if (completedSet.has(dateStr)) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Backward pass for current streak
    // Skip today if it hasn't been completed yet (the day isn't over)
    let currentStreak = 0;
    let startIdx = scheduledDates.length - 1;
    const todayStr = toDateString(today);
    if (
      startIdx >= 0 &&
      scheduledDates[startIdx] === todayStr &&
      !completedSet.has(todayStr)
    ) {
      startIdx--;
    }
    for (let i = startIdx; i >= 0; i--) {
      if (completedSet.has(scheduledDates[i])) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { currentStreak, longestStreak };
  }
}

export default new StreakService();

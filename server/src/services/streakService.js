import { toDateString, addDays, getTodayUTC, getDayOfWeek } from '../utils/dateHelpers.js';

class StreakService {
  calculateStreaks(logs, frequency, target, habitCreatedAt) {
    const completedSet = new Set();

    for (const log of logs) {
      const isCompleted =
        typeof log.value === 'boolean' ? log.value === true : log.value >= target;
      if (isCompleted) {
        completedSet.add(toDateString(log.date));
      }
    }

    const today = getTodayUTC();
    const startDate = new Date(habitCreatedAt);
    // Normalize to UTC midnight so creation time-of-day doesn't affect streak calc
    startDate.setUTCHours(0, 0, 0, 0);
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
    let currentStreak = 0;
    for (let i = scheduledDates.length - 1; i >= 0; i--) {
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

import HabitLog from '../models/HabitLog.js';
import Habit from '../models/Habit.js';
import notificationService from './notificationService.js';
import emailService from './emailService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';

class WeeklySummaryService {
  async generateSummary(userId) {
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 7);

    const habits = await Habit.find({ userId, isArchived: false });
    if (habits.length === 0) return null;

    const logs = await HabitLog.find({
      userId,
      date: { $gte: startDate, $lt: endDate },
    });

    let completedCount = 0;
    let totalExpected = 0;

    for (const habit of habits) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setUTCDate(date.getUTCDate() + d);
        const dayOfWeek = date.getUTCDay();

        if (habit.frequency.includes(dayOfWeek)) {
          totalExpected++;
          const dateStr = date.toISOString().split('T')[0];
          const log = logs.find(
            (l) => l.habitId.toString() === habit._id.toString() && l.date.toISOString().split('T')[0] === dateStr
          );
          if (log) {
            const isComplete = typeof log.value === 'boolean' ? log.value : log.value >= habit.target;
            if (isComplete) completedCount++;
          }
        }
      }
    }

    const rate = totalExpected > 0 ? Math.round((completedCount / totalExpected) * 100) : 0;
    const bestHabit = habits.reduce((best, h) => (h.currentStreak > (best?.currentStreak || 0) ? h : best), null);

    return {
      totalHabits: habits.length,
      completedCount,
      totalExpected,
      completionRate: rate,
      bestHabit: bestHabit?.name || 'N/A',
      bestStreak: bestHabit?.currentStreak || 0,
    };
  }

  async sendWeeklySummaries() {
    const users = await notificationService.getScheduledUsers(
      NOTIFICATION_TYPES.WEEKLY_SUMMARY,
      'name email emailVerified settings'
    );
    let sent = 0;

    for (const user of users) {
      try {
        const summary = await this.generateSummary(user._id);
        if (!summary) continue;

        await notificationService.sendWithUser(user, NOTIFICATION_TYPES.WEEKLY_SUMMARY, {
          pushPayload: {
            title: `Weekly Summary: ${summary.completionRate}% completion`,
            body: `${summary.completedCount}/${summary.totalExpected} habits done. Best streak: ${summary.bestHabit} (${summary.bestStreak}d)`,
            icon: '/pwa-192x192.png',
            tag: 'weekly-summary',
          },
          emailFn: (u) =>
            emailService.sendWeeklySummaryEmail(u.email, u.name, summary),
        });
        sent++;
      } catch (err) {
        console.error(`[Weekly Summary] Error for user ${user._id}:`, err.message);
      }
    }

    console.log(`[Weekly Summary] Sent ${sent} notifications`);
  }
}

export default new WeeklySummaryService();

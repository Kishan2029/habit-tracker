import cron from 'node-cron';
import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { getHourInTimezone, getTodayInTimezone } from '../utils/dateHelpers.js';

async function sendDailyReminders() {
  console.log('[Cron] Running daily reminder check...');

  // Step 1: Get users who have push or email reminders enabled
  const users = await User.find({
    $or: [
      { 'settings.notifications.dailyReminders.push': { $ne: false } },
      { 'settings.notifications.dailyReminders.email': true, emailVerified: true },
    ],
  }, 'name email emailVerified settings');

  // Step 3: Filter to users whose local time matches their reminder hour
  const eligibleUsers = [];
  for (const user of users) {
    const tz = user.settings?.timezone || 'UTC';
    const reminderTime = user.settings?.reminderTime || '08:00';
    const [targetHour] = reminderTime.split(':').map(Number);
    const userLocalHour = getHourInTimezone(new Date(), tz);
    if (userLocalHour === targetHour) {
      eligibleUsers.push({ user, tz });
    }
  }

  if (eligibleUsers.length === 0) return;

  // Step 4: Bulk-load habits and logs for eligible users
  const eligibleUserIds = eligibleUsers.map((e) => e.user._id);

  // Group users by their local today date (most will share the same date)
  const dateGroups = new Map();
  for (const { user, tz } of eligibleUsers) {
    const userToday = getTodayInTimezone(tz);
    const dateKey = userToday.toISOString();
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, { date: userToday, dayOfWeek: userToday.getUTCDay(), users: [] });
    }
    dateGroups.get(dateKey).users.push(user);
  }

  let sent = 0;

  for (const { date, dayOfWeek, users: groupUsers } of dateGroups.values()) {
    const groupUserIds = groupUsers.map((u) => u._id);

    // Bulk fetch habits scheduled for today for all users in this date group
    const habits = await Habit.find({
      userId: { $in: groupUserIds },
      isArchived: false,
      frequency: { $in: [dayOfWeek] },
    });

    // Bulk fetch logs for today for these habits
    const habitIds = habits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId: { $in: groupUserIds },
      date,
      habitId: { $in: habitIds },
    });

    // Index logs by `userId:habitId`
    const logSet = new Set(logs.map((l) => `${l.userId}:${l.habitId}`));

    // Process each user
    for (const user of groupUsers) {
      try {
        const userHabits = habits.filter((h) => h.userId.toString() === user._id.toString());
        const pendingHabits = userHabits.filter((h) => !logSet.has(`${user._id}:${h._id}`));

        if (pendingHabits.length === 0) continue;

        const habitNames = pendingHabits.slice(0, 3).map((h) => h.name).join(', ');
        const extra = pendingHabits.length > 3 ? ` and ${pendingHabits.length - 3} more` : '';

        await notificationService.sendWithUser(user, NOTIFICATION_TYPES.DAILY_REMINDER, {
          pushPayload: {
            title: 'Daily Habits Reminder',
            body: `You have ${pendingHabits.length} habit${pendingHabits.length > 1 ? 's' : ''} to complete today: ${habitNames}${extra}`,
            icon: '/pwa-192x192.png',
            tag: 'daily-reminder',
            data: { url: '/' },
          },
          emailFn: (u) =>
            emailService.sendDailyReminderEmail(u.email, u.name, pendingHabits),
        });
        sent++;
      } catch (err) {
        console.error(`[Daily Reminder] Error for user ${user._id}:`, err.message);
      }
    }
  }

  console.log(`[Daily Reminder] Sent ${sent} reminders`);
}

export function startDailyReminderJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      await sendDailyReminders();
    } catch (err) {
      console.error('[Cron] Daily reminder job failed:', err.message);
    }
  });

  console.log('[Cron] Daily reminder job scheduled (every hour)');
}

import cron from 'node-cron';
import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import PushSubscription from '../models/PushSubscription.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { getHourInTimezone, getTodayInTimezone } from '../utils/dateHelpers.js';

async function sendDailyReminders() {
  const currentUTCHour = new Date().getUTCHours();
  console.log(`[Cron] Running daily reminder check (UTC hour: ${currentUTCHour})...`);

  // Get all users with push subscriptions (they've opted into notifications)
  const subs = await PushSubscription.find();
  let sent = 0;

  for (const sub of subs) {
    try {
      const user = await User.findById(sub.userId, 'name email emailVerified settings');
      if (!user) continue;

      // Check if user wants daily reminders
      const prefs = user.settings?.notifications?.dailyReminders;
      if (prefs?.push === false && prefs?.email === false) continue;

      const tz = user.settings?.timezone || 'UTC';
      const reminderTime = user.settings?.reminderTime || '08:00';
      const [targetHour] = reminderTime.split(':').map(Number);

      // Check if current UTC hour matches user's reminder hour in their timezone
      const userLocalHour = getHourInTimezone(new Date(), tz);
      if (userLocalHour !== targetHour) continue;

      // Get today's date in user's timezone
      const userToday = getTodayInTimezone(tz);
      const dayOfWeek = userToday.getUTCDay();

      // Find habits scheduled for today
      const habits = await Habit.find({
        userId: sub.userId,
        isArchived: false,
        frequency: { $in: [dayOfWeek] },
      });
      if (habits.length === 0) continue;

      // Find which habits are already logged
      const logs = await HabitLog.find({
        userId: sub.userId,
        date: userToday,
        habitId: { $in: habits.map((h) => h._id) },
      });

      const loggedIds = new Set(logs.map((l) => l.habitId.toString()));
      const pendingHabits = habits.filter((h) => !loggedIds.has(h._id.toString()));
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
      console.error(`[Daily Reminder] Error for user ${sub.userId}:`, err.message);
    }
  }

  console.log(`[Daily Reminder] Sent ${sent} reminders`);
}

export function startDailyReminderJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      await sendDailyReminders();
    } catch (err) {
      console.error('[Cron] Daily reminder job failed:', err.message);
    }
  });

  console.log('[Cron] Daily reminder job scheduled (every hour)');
}

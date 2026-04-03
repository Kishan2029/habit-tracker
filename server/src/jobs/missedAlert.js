import cron from 'node-cron';
import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import PushSubscription from '../models/PushSubscription.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { getHourInTimezone, getYesterdayInTimezone } from '../utils/dateHelpers.js';

const MISSED_ALERT_HOUR = 10; // 10:00 AM in user's local time

async function sendMissedAlerts() {
  const currentUTCHour = new Date().getUTCHours();
  console.log(`[Cron] Running missed alert check (UTC hour: ${currentUTCHour})...`);

  const subs = await PushSubscription.find();
  let sent = 0;

  for (const sub of subs) {
    try {
      const user = await User.findById(sub.userId, 'name email emailVerified settings');
      if (!user) continue;

      const prefs = user.settings?.notifications?.missedAlerts;
      if (prefs?.push === false && prefs?.email === false) continue;

      const tz = user.settings?.timezone || 'UTC';
      const userLocalHour = getHourInTimezone(new Date(), tz);
      if (userLocalHour !== MISSED_ALERT_HOUR) continue;

      // Get yesterday in user's timezone
      const yesterday = getYesterdayInTimezone(tz);
      const dayOfWeek = yesterday.getUTCDay();

      // Find habits that were scheduled yesterday
      const habits = await Habit.find({
        userId: sub.userId,
        isArchived: false,
        frequency: { $in: [dayOfWeek] },
      });
      if (habits.length === 0) continue;

      // Find completed logs for yesterday
      const logs = await HabitLog.find({
        userId: sub.userId,
        date: yesterday,
        habitId: { $in: habits.map((h) => h._id) },
      });

      const completedIds = new Set();
      for (const log of logs) {
        const habit = habits.find((h) => h._id.toString() === log.habitId.toString());
        if (!habit) continue;
        const isComplete = typeof log.value === 'boolean' ? log.value : log.value >= habit.target;
        if (isComplete) completedIds.add(log.habitId.toString());
      }

      const missedHabits = habits.filter((h) => !completedIds.has(h._id.toString()));
      if (missedHabits.length === 0) continue;

      const habitNames = missedHabits.slice(0, 3).map((h) => h.name).join(', ');
      const extra = missedHabits.length > 3 ? ` and ${missedHabits.length - 3} more` : '';

      await notificationService.sendWithUser(user, NOTIFICATION_TYPES.MISSED_ALERT, {
        pushPayload: {
          title: 'Missed habits yesterday',
          body: `You missed ${missedHabits.length} habit${missedHabits.length > 1 ? 's' : ''} yesterday: ${habitNames}${extra}. Don't break your streak!`,
          icon: '/pwa-192x192.png',
          tag: 'missed-alert',
          data: { url: '/' },
        },
        emailFn: (u) =>
          emailService.sendMissedHabitEmail(u.email, u.name, missedHabits),
      });
      sent++;
    } catch (err) {
      console.error(`[Missed Alert] Error for user ${sub.userId}:`, err.message);
    }
  }

  console.log(`[Missed Alert] Sent ${sent} alerts`);
}

export function startMissedAlertJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      await sendMissedAlerts();
    } catch (err) {
      console.error('[Cron] Missed alert job failed:', err.message);
    }
  });

  console.log('[Cron] Missed alert job scheduled (every hour)');
}

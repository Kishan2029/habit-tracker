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
  console.log('[Cron] Running missed alert check...');

  // Step 1: Get all subscribed user IDs
  const subs = await PushSubscription.find({}, 'userId');
  if (subs.length === 0) return;

  const subscribedUserIds = subs.map((s) => s.userId);

  // Step 2: Bulk-load users who have missed alerts enabled
  const users = await User.find({
    _id: { $in: subscribedUserIds },
    'settings.notifications.missedAlerts.push': { $ne: false },
  }, 'name email emailVerified settings');

  // Step 3: Filter to users whose local time is the missed alert hour
  const eligibleUsers = [];
  for (const user of users) {
    const tz = user.settings?.timezone || 'UTC';
    const userLocalHour = getHourInTimezone(new Date(), tz);
    if (userLocalHour === MISSED_ALERT_HOUR) {
      eligibleUsers.push({ user, tz });
    }
  }

  if (eligibleUsers.length === 0) return;

  // Step 4: Group by yesterday date, bulk-load habits and logs
  const dateGroups = new Map();
  for (const { user, tz } of eligibleUsers) {
    const yesterday = getYesterdayInTimezone(tz);
    const dateKey = yesterday.toISOString();
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, { date: yesterday, dayOfWeek: yesterday.getUTCDay(), users: [] });
    }
    dateGroups.get(dateKey).users.push(user);
  }

  let sent = 0;

  for (const { date, dayOfWeek, users: groupUsers } of dateGroups.values()) {
    const groupUserIds = groupUsers.map((u) => u._id);

    // Bulk fetch habits scheduled for yesterday
    const habits = await Habit.find({
      userId: { $in: groupUserIds },
      isArchived: false,
      frequency: { $in: [dayOfWeek] },
    });

    // Bulk fetch logs for yesterday
    const habitIds = habits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId: { $in: groupUserIds },
      date,
      habitId: { $in: habitIds },
    });

    // Index completed logs by `userId:habitId`
    const completedSet = new Set();
    for (const log of logs) {
      const habit = habits.find((h) => h._id.toString() === log.habitId.toString());
      if (!habit) continue;
      const isComplete = typeof log.value === 'boolean' ? log.value : log.value >= habit.target;
      if (isComplete) completedSet.add(`${log.userId}:${log.habitId}`);
    }

    for (const user of groupUsers) {
      try {
        const userHabits = habits.filter((h) => h.userId.toString() === user._id.toString());
        const missedHabits = userHabits.filter((h) => !completedSet.has(`${user._id}:${h._id}`));

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
        console.error(`[Missed Alert] Error for user ${user._id}:`, err.message);
      }
    }
  }

  console.log(`[Missed Alert] Sent ${sent} alerts`);
}

export function startMissedAlertJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      await sendMissedAlerts();
    } catch (err) {
      console.error('[Cron] Missed alert job failed:', err.message);
    }
  });

  console.log('[Cron] Missed alert job scheduled (every hour)');
}

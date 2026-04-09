import cron from 'node-cron';
import notificationService from '../services/notificationService.js';
import weeklySummaryService from '../services/weeklySummaryService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { getHourInTimezone, getTodayInTimezone } from '../utils/dateHelpers.js';

const WEEKLY_SUMMARY_HOUR = 9; // 9:00 AM in user's local time

async function sendWeeklySummariesByTimezone() {
  console.log('[Cron] Running weekly summary check...');

  const users = await notificationService.getScheduledUsers(
    NOTIFICATION_TYPES.WEEKLY_SUMMARY,
    'name email emailVerified settings'
  );

  let sent = 0;

  for (const user of users) {
    try {
      const tz = user.settings?.timezone || 'UTC';
      const userLocalHour = getHourInTimezone(new Date(), tz);

      if (userLocalHour !== WEEKLY_SUMMARY_HOUR) continue;

      // getTodayInTimezone returns a UTC-midnight Date representing the user's
      // local date, so getUTCDay() gives the correct local day-of-week.
      const userToday = getTodayInTimezone(tz);
      if (userToday.getUTCDay() !== 0) continue;

      const result = await weeklySummaryService.sendWeeklySummaryForUser(user);
      if (result) sent++;
    } catch (err) {
      console.error(`[Weekly Summary] Error for user ${user._id}:`, err.message);
    }
  }

  console.log(`[Weekly Summary] Sent ${sent} notifications`);
}

export function startWeeklySummaryJob() {
  // Run every hour so we can check each user's local timezone
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running weekly summary job...');
    try {
      await sendWeeklySummariesByTimezone();
    } catch (err) {
      console.error('[Cron] Weekly summary failed:', err.message);
    }
  });

  console.log('[Cron] Weekly summary job scheduled (every hour, Sunday 9:00 AM user local time)');
}

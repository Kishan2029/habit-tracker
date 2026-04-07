import cron from 'node-cron';
import User from '../models/User.js';
import weeklySummaryService from '../services/weeklySummaryService.js';
import { getHourInTimezone, getTodayInTimezone } from '../utils/dateHelpers.js';

const WEEKLY_SUMMARY_HOUR = 9; // 9:00 AM in user's local time

async function sendWeeklySummariesByTimezone() {
  console.log('[Cron] Running weekly summary check...');

  const users = await User.find({
    $or: [
      { 'settings.notifications.weeklySummary.push': { $ne: false } },
      { 'settings.notifications.weeklySummary.email': true, emailVerified: true },
    ],
  }, 'name email emailVerified settings');

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

      await weeklySummaryService.sendWeeklySummaryForUser(user);
      sent++;
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

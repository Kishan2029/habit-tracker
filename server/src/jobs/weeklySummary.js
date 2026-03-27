import cron from 'node-cron';
import weeklySummaryService from '../services/weeklySummaryService.js';

export function startWeeklySummaryJob() {
  // Run every Sunday at 9:00 AM
  cron.schedule('0 9 * * 0', async () => {
    console.log('[Cron] Running weekly summary job...');
    try {
      await weeklySummaryService.sendWeeklySummaries();
    } catch (err) {
      console.error('[Cron] Weekly summary failed:', err.message);
    }
  });

  console.log('[Cron] Weekly summary job scheduled (Sunday 9:00 AM)');
}

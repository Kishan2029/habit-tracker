import User from '../models/User.js';
import pushService from './pushService.js';
import emailService from './emailService.js';

class NotificationService {
  /**
   * Send a notification respecting user preferences.
   * @param {string} userId
   * @param {string} type - one of NOTIFICATION_TYPES values (e.g. 'dailyReminders')
   * @param {object} payload
   *   pushPayload: { title, body, icon, tag, url }
   *   emailFn: async function that sends the email (called only if user wants email)
   */
  async send(userId, type, { pushPayload, emailFn }) {
    let user;
    try {
      user = await User.findById(userId, 'settings emailVerified email name');
    } catch (err) {
      console.error(`[Notify] Failed to load user ${userId}:`, err.message);
      return;
    }
    if (!user) return;

    const prefs = user.settings?.notifications?.[type];
    const wantsPush = prefs?.push ?? true;
    const wantsEmail = prefs?.email ?? false;

    if (wantsPush && pushPayload) {
      pushService.sendNotification(userId, pushPayload).catch((err) =>
        console.error(`[Notify] Push failed for ${userId}:`, err.message)
      );
    }

    if (wantsEmail && emailFn && user.emailVerified && emailService.isConfigured) {
      Promise.resolve(emailFn(user)).catch((err) =>
        console.error(`[Notify] Email failed for ${userId}:`, err.message)
      );
    }
  }

  /**
   * Send a notification with a pre-loaded user (avoids extra DB query in batch jobs).
   */
  async sendWithUser(user, type, { pushPayload, emailFn }) {
    const prefs = user.settings?.notifications?.[type];
    const wantsPush = prefs?.push ?? true;
    const wantsEmail = prefs?.email ?? false;

    if (wantsPush && pushPayload) {
      pushService.sendNotification(user._id, pushPayload).catch((err) =>
        console.error(`[Notify] Push failed for ${user._id}:`, err.message)
      );
    }

    if (wantsEmail && emailFn && user.emailVerified && emailService.isConfigured) {
      Promise.resolve(emailFn(user)).catch((err) =>
        console.error(`[Notify] Email failed for ${user._id}:`, err.message)
      );
    }
  }
}

export default new NotificationService();

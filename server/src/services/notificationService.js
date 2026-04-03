import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import pushService from './pushService.js';
import emailService from './emailService.js';

class NotificationService {
  async getScheduledUsers(type, projection = 'name email emailVerified settings') {
    const [subs, emailUsers] = await Promise.all([
      PushSubscription.find({}, 'userId'),
      User.find(
        {
          emailVerified: true,
          [`settings.notifications.${type}.email`]: true,
        },
        projection
      ),
    ]);

    const subscribedUserIds = [...new Set(subs.map((sub) => sub.userId.toString()))];
    const pushUsers = subscribedUserIds.length > 0
      ? await User.find(
          {
            _id: { $in: subscribedUserIds },
            [`settings.notifications.${type}.push`]: { $ne: false },
          },
          projection
        )
      : [];

    const usersById = new Map();
    for (const user of [...pushUsers, ...emailUsers]) {
      usersById.set(user._id.toString(), user);
    }

    return [...usersById.values()];
  }

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

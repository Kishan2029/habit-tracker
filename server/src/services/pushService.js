import webPush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import env from '../config/env.js';

class PushService {
  constructor() {
    this.isConfigured = !!(env.vapid.publicKey && env.vapid.privateKey);
    if (this.isConfigured) {
      webPush.setVapidDetails(env.vapid.email, env.vapid.publicKey, env.vapid.privateKey);
    }
  }

  async subscribe(userId, subscription) {
    return PushSubscription.findOneAndUpdate(
      { userId },
      { userId, subscription },
      { upsert: true, new: true }
    );
  }

  async unsubscribe(userId) {
    return PushSubscription.findOneAndDelete({ userId });
  }

  async sendNotification(userId, payload) {
    if (!this.isConfigured) {
      console.warn('[Push] VAPID keys not configured — skipping notification');
      return { sent: false, reason: 'not_configured' };
    }

    const sub = await PushSubscription.findOne({ userId });
    if (!sub) {
      console.warn(`[Push] No subscription found for user ${userId}`);
      return { sent: false, reason: 'no_subscription' };
    }

    console.log(`[Push] Sending to user ${userId}, endpoint: ${sub.subscription.endpoint.substring(0, 60)}...`);

    try {
      const result = await webPush.sendNotification(sub.subscription, JSON.stringify(payload));
      console.log(`[Push] Success — FCM status: ${result.statusCode}`);
      return { sent: true, statusCode: result.statusCode };
    } catch (err) {
      console.error(`[Push] Failed — status: ${err.statusCode}, body: ${err.body || err.message}`);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.findOneAndDelete({ userId });
        console.warn(`[Push] Subscription expired/invalid — removed from DB`);
      }
      return { sent: false, reason: 'send_failed', statusCode: err.statusCode, error: err.body || err.message };
    }
  }

  async sendToAll(payload) {
    if (!this.isConfigured) return;

    const subs = await PushSubscription.find();
    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(sub.subscription, JSON.stringify(payload));
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.findOneAndDelete({ _id: sub._id });
          }
        }
      })
    );
    return results;
  }
}

export default new PushService();

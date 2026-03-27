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
    if (!this.isConfigured) return;

    const sub = await PushSubscription.findOne({ userId });
    if (!sub) return;

    try {
      await webPush.sendNotification(sub.subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.findOneAndDelete({ userId });
      }
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

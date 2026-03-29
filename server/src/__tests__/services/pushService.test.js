import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendNotification = jest.fn();

jest.unstable_mockModule('web-push', () => ({
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: mockSendNotification,
  },
}));

jest.unstable_mockModule('../../models/PushSubscription.js', () => ({
  default: {
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    vapid: {
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
      email: 'mailto:test@test.com',
    },
  },
}));

const { default: PushSubscription } = await import('../../models/PushSubscription.js');
const PushServiceModule = await import('../../services/pushService.js');
const pushService = PushServiceModule.default;

describe('PushService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should upsert push subscription', async () => {
      const sub = { endpoint: 'https://push.example.com', keys: {} };
      PushSubscription.findOneAndUpdate.mockResolvedValue({ userId: 'u1', subscription: sub });

      await pushService.subscribe('u1', sub);

      expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'u1' },
        { userId: 'u1', subscription: sub },
        { upsert: true, new: true }
      );
    });
  });

  describe('unsubscribe', () => {
    it('should delete push subscription', async () => {
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.unsubscribe('u1');

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });

  describe('sendNotification', () => {
    it('should send notification to user', async () => {
      const sub = { subscription: { endpoint: 'https://push.example.com' } };
      PushSubscription.findOne.mockResolvedValue(sub);
      mockSendNotification.mockResolvedValue({});

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(mockSendNotification).toHaveBeenCalledWith(
        sub.subscription,
        JSON.stringify({ title: 'Test' })
      );
    });

    it('should do nothing if no subscription found', async () => {
      PushSubscription.findOne.mockResolvedValue(null);

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('should remove subscription on 410 error', async () => {
      PushSubscription.findOne.mockResolvedValue({
        subscription: { endpoint: 'https://push.example.com' },
      });
      mockSendNotification.mockRejectedValue({ statusCode: 410 });
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('should remove subscription on 404 error', async () => {
      PushSubscription.findOne.mockResolvedValue({
        subscription: { endpoint: 'https://push.example.com' },
      });
      mockSendNotification.mockRejectedValue({ statusCode: 404 });
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });

  describe('sendToAll', () => {
    it('should send to all subscribers', async () => {
      const subs = [
        { _id: 's1', subscription: { endpoint: 'https://push1.com' } },
        { _id: 's2', subscription: { endpoint: 'https://push2.com' } },
      ];
      PushSubscription.find.mockResolvedValue(subs);
      mockSendNotification.mockResolvedValue({});

      await pushService.sendToAll({ title: 'Broadcast' });

      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('should remove expired subscriptions during broadcast', async () => {
      const subs = [
        { _id: 's1', subscription: { endpoint: 'https://push1.com' } },
      ];
      PushSubscription.find.mockResolvedValue(subs);
      mockSendNotification.mockRejectedValue({ statusCode: 410 });
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendToAll({ title: 'Broadcast' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ _id: 's1' });
    });
  });
});

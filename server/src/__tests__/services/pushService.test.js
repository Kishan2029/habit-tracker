import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendNotification = jest.fn();
const mockSetVapidDetails = jest.fn();

jest.unstable_mockModule('web-push', () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
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
      email: 'mailto:admin@test.com',
    },
  },
}));

const { default: PushSubscription } = await import('../../models/PushSubscription.js');
const { default: pushService } = await import('../../services/pushService.js');

describe('PushService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be configured when VAPID keys are present', () => {
      expect(pushService.isConfigured).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should upsert push subscription', async () => {
      const subscription = { endpoint: 'https://push.example.com', keys: {} };
      PushSubscription.findOneAndUpdate.mockResolvedValue({});

      await pushService.subscribe('u1', subscription);

      expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'u1' },
        { userId: 'u1', subscription },
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

      const payload = { title: 'Test', body: 'Hello' };
      await pushService.sendNotification('u1', payload);

      expect(mockSendNotification).toHaveBeenCalledWith(
        sub.subscription,
        JSON.stringify(payload)
      );
    });

    it('should do nothing if not configured', async () => {
      const originalConfigured = pushService.isConfigured;
      try {
        pushService.isConfigured = false;
        await pushService.sendNotification('u1', { title: 'Test' });

        expect(PushSubscription.findOne).not.toHaveBeenCalled();
      } finally {
        pushService.isConfigured = originalConfigured;
      }
    });

    it('should do nothing if no subscription found', async () => {
      PushSubscription.findOne.mockResolvedValue(null);

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('should clean up subscription on 410 error', async () => {
      PushSubscription.findOne.mockResolvedValue({
        subscription: { endpoint: 'https://push.example.com' },
      });
      const error = new Error('Gone');
      error.statusCode = 410;
      mockSendNotification.mockRejectedValue(error);
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('should clean up subscription on 404 error', async () => {
      PushSubscription.findOne.mockResolvedValue({
        subscription: { endpoint: 'https://push.example.com' },
      });
      const error = new Error('Not Found');
      error.statusCode = 404;
      mockSendNotification.mockRejectedValue(error);
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('should not clean up on other errors', async () => {
      PushSubscription.findOne.mockResolvedValue({
        subscription: { endpoint: 'https://push.example.com' },
      });
      const error = new Error('Server error');
      error.statusCode = 500;
      mockSendNotification.mockRejectedValue(error);

      await pushService.sendNotification('u1', { title: 'Test' });

      expect(PushSubscription.findOneAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('sendToAll', () => {
    it('should send notifications to all subscribers', async () => {
      const subs = [
        { _id: 's1', subscription: { endpoint: 'https://push1.example.com' } },
        { _id: 's2', subscription: { endpoint: 'https://push2.example.com' } },
      ];
      PushSubscription.find.mockResolvedValue(subs);
      mockSendNotification.mockResolvedValue({});

      const payload = { title: 'Test' };
      const results = await pushService.sendToAll(payload);

      expect(mockSendNotification).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });

    it('should do nothing if not configured', async () => {
      const originalConfigured = pushService.isConfigured;
      try {
        pushService.isConfigured = false;
        await pushService.sendToAll({ title: 'Test' });

        expect(PushSubscription.find).not.toHaveBeenCalled();
      } finally {
        pushService.isConfigured = originalConfigured;
      }
    });

    it('should clean up expired subscriptions during sendToAll', async () => {
      const subs = [
        { _id: 's1', subscription: { endpoint: 'https://push1.example.com' } },
      ];
      PushSubscription.find.mockResolvedValue(subs);
      const error = new Error('Gone');
      error.statusCode = 410;
      mockSendNotification.mockRejectedValue(error);
      PushSubscription.findOneAndDelete.mockResolvedValue({});

      await pushService.sendToAll({ title: 'Test' });

      expect(PushSubscription.findOneAndDelete).toHaveBeenCalledWith({ _id: 's1' });
    });
  });
});

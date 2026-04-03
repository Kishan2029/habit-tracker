import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/PushSubscription.js', () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/pushService.js', () => ({
  default: {
    sendNotification: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    isConfigured: true,
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: PushSubscription } = await import('../../models/PushSubscription.js');
const { default: notificationService } = await import('../../services/notificationService.js');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getScheduledUsers', () => {
    it('should include subscribed push users and verified email-only users without duplicates', async () => {
      PushSubscription.find.mockResolvedValue([
        { userId: { toString: () => 'push-user' } },
        { userId: { toString: () => 'shared-user' } },
      ]);

      User.find
        .mockResolvedValueOnce([
          { _id: { toString: () => 'email-user' }, email: 'email@test.com' },
          { _id: { toString: () => 'shared-user' }, email: 'shared@test.com' },
        ])
        .mockResolvedValueOnce([
          { _id: { toString: () => 'push-user' }, email: 'push@test.com' },
          { _id: { toString: () => 'shared-user' }, email: 'shared@test.com' },
        ]);

      const users = await notificationService.getScheduledUsers('weeklySummary');

      expect(PushSubscription.find).toHaveBeenCalledWith({}, 'userId');
      expect(User.find).toHaveBeenNthCalledWith(
        1,
        {
          emailVerified: true,
          'settings.notifications.weeklySummary.email': true,
        },
        'name email emailVerified settings'
      );
      expect(User.find).toHaveBeenNthCalledWith(
        2,
        {
          _id: { $in: ['push-user', 'shared-user'] },
          'settings.notifications.weeklySummary.push': { $ne: false },
        },
        'name email emailVerified settings'
      );
      expect(users.map((user) => user._id.toString())).toEqual([
        'push-user',
        'shared-user',
        'email-user',
      ]);
    });
  });
});

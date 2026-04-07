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
const { default: pushService } = await import('../../services/pushService.js');
const { default: emailService } = await import('../../services/emailService.js');
const { default: notificationService } = await import('../../services/notificationService.js');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pushService.sendNotification.mockResolvedValue();
  });

  describe('getScheduledUsers', () => {
    it('should include subscribed push users and verified email-only users without duplicates', async () => {
      PushSubscription.find.mockResolvedValue([
        { userId: { toString: () => 'push-user' } },
        { userId: { toString: () => 'shared-user' } },
      ]);

      User.find.mockResolvedValue([
        { _id: { toString: () => 'push-user' }, email: 'push@test.com' },
        { _id: { toString: () => 'shared-user' }, email: 'shared@test.com' },
        { _id: { toString: () => 'email-user' }, email: 'email@test.com' },
      ]);

      const users = await notificationService.getScheduledUsers('weeklySummary');

      expect(PushSubscription.find).toHaveBeenCalledWith({}, 'userId');
      expect(User.find).toHaveBeenCalledWith(
        {
          $or: [
            {
              _id: { $in: ['push-user', 'shared-user'] },
              'settings.notifications.weeklySummary.push': { $ne: false },
            },
            {
              emailVerified: true,
              'settings.notifications.weeklySummary.email': true,
            },
          ],
        },
        'name email emailVerified settings'
      );
      expect(users.map((user) => user._id.toString())).toEqual(['push-user', 'shared-user', 'email-user']);
    });
  });

  describe('send', () => {
    const pushPayload = { title: 'Test', body: 'Hello' };
    const emailFn = jest.fn().mockResolvedValue();

    it('should call emailFn when user opted in for email and email is verified', async () => {
      const user = {
        _id: 'u1',
        emailVerified: true,
        email: 'user@test.com',
        name: 'Alice',
        settings: { notifications: { streakMilestones: { push: true, email: true } } },
      };
      User.findById.mockResolvedValue(user);

      await notificationService.send('u1', 'streakMilestones', { pushPayload, emailFn });

      // Wait for fire-and-forget promises
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).toHaveBeenCalledWith(user);
      expect(pushService.sendNotification).toHaveBeenCalledWith('u1', pushPayload);
    });

    it('should NOT call emailFn when user opted out of email', async () => {
      User.findById.mockResolvedValue({
        _id: 'u2',
        emailVerified: true,
        email: 'user@test.com',
        settings: { notifications: { dailyReminders: { push: true, email: false } } },
      });

      await notificationService.send('u2', 'dailyReminders', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).not.toHaveBeenCalled();
      expect(pushService.sendNotification).toHaveBeenCalled();
    });

    it('should NOT call emailFn when email is not verified even if opted in', async () => {
      User.findById.mockResolvedValue({
        _id: 'u3',
        emailVerified: false,
        email: 'user@test.com',
        settings: { notifications: { streakMilestones: { push: true, email: true } } },
      });

      await notificationService.send('u3', 'streakMilestones', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).not.toHaveBeenCalled();
    });

    it('should default email to false when no preferences are set', async () => {
      User.findById.mockResolvedValue({
        _id: 'u4',
        emailVerified: true,
        email: 'user@test.com',
        settings: {},
      });

      await notificationService.send('u4', 'dailyReminders', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).not.toHaveBeenCalled();
      // push defaults to true
      expect(pushService.sendNotification).toHaveBeenCalled();
    });

    it('should not send anything when user is not found', async () => {
      User.findById.mockResolvedValue(null);

      await notificationService.send('missing', 'dailyReminders', { pushPayload, emailFn });

      expect(emailFn).not.toHaveBeenCalled();
      expect(pushService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle DB errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      User.findById.mockRejectedValue(new Error('DB error'));

      await notificationService.send('u5', 'dailyReminders', { pushPayload, emailFn });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Notify] Failed to load user u5:',
        'DB error'
      );
      expect(emailFn).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('sendWithUser', () => {
    const pushPayload = { title: 'Test', body: 'Hello' };
    const emailFn = jest.fn().mockResolvedValue();

    it('should call emailFn when user opted in and email is verified', async () => {
      const user = {
        _id: 'u1',
        emailVerified: true,
        email: 'user@test.com',
        name: 'Alice',
        settings: { notifications: { goalCompletion: { push: true, email: true } } },
      };

      await notificationService.sendWithUser(user, 'goalCompletion', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).toHaveBeenCalledWith(user);
      expect(pushService.sendNotification).toHaveBeenCalledWith('u1', pushPayload);
    });

    it('should NOT call emailFn when user opted out', async () => {
      const user = {
        _id: 'u2',
        emailVerified: true,
        settings: { notifications: { missedAlerts: { push: true, email: false } } },
      };

      await notificationService.sendWithUser(user, 'missedAlerts', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).not.toHaveBeenCalled();
    });

    it('should NOT call emailFn when email not verified', async () => {
      const user = {
        _id: 'u3',
        emailVerified: false,
        settings: { notifications: { goalCompletion: { push: false, email: true } } },
      };

      await notificationService.sendWithUser(user, 'goalCompletion', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(emailFn).not.toHaveBeenCalled();
      expect(pushService.sendNotification).not.toHaveBeenCalled();
    });

    it('should skip push when user opted out of push', async () => {
      const user = {
        _id: 'u4',
        emailVerified: true,
        settings: { notifications: { weeklySummary: { push: false, email: true } } },
      };

      await notificationService.sendWithUser(user, 'weeklySummary', { pushPayload, emailFn });
      await new Promise((r) => setTimeout(r, 10));

      expect(pushService.sendNotification).not.toHaveBeenCalled();
      expect(emailFn).toHaveBeenCalledWith(user);
    });
  });
});

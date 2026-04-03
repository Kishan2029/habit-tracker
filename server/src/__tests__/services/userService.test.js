import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    port: 5000,
    mongodbUri: 'mongodb://localhost/test',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '7d',
    nodeEnv: 'test',
    clientUrl: 'http://localhost:5173',
    corsOrigin: 'http://localhost:5173',
    smtp: { host: '', user: '', pass: '', port: 587 },
    emailFrom: 'test@test.com',
    adminEmail: '',
    cloudinary: { cloudName: '', apiKey: '', apiSecret: '' },
    vapid: { publicKey: '', privateKey: '', email: '' },
  },
}));

jest.unstable_mockModule('../../config/cloudinary.js', () => ({
  default: {
    config: () => ({}),
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: userService } = await import('../../services/userService.js');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = { _id: 'user1', name: 'John', email: 'john@test.com' };
      User.findById.mockResolvedValue(mockUser);

      const result = await userService.getProfile('user1');
      expect(result).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith('user1');
    });

    it('should throw 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(userService.getProfile('nonexistent')).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });
  });

  describe('updateProfile', () => {
    it('should update allowed fields only', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: { theme: 'system', timezone: 'UTC', notifications: {}, reminderTime: '08:00' },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      const result = await userService.updateProfile('user1', {
        name: 'Updated',
        email: 'hacker@evil.com', // should be ignored
        role: 'admin', // should be ignored
        settings: { theme: 'dark' },
      });

      expect(mockUser.name).toBe('Updated');
      expect(mockUser.settings.theme).toBe('dark');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw 404 if user not found during update', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        userService.updateProfile('nonexistent', { name: 'Test' })
      ).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should handle empty updates (no allowed fields)', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: { theme: 'system', timezone: 'UTC', notifications: {}, reminderTime: '08:00' },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', { email: 'test@test.com' });

      // Name unchanged, save still called
      expect(mockUser.name).toBe('John');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should merge notification preferences without overwriting', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'dark',
          timezone: 'UTC',
          reminderTime: '08:00',
          notifications: {
            dailyReminders: { push: true, email: false },
            streakMilestones: { push: true, email: true },
          },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          notifications: {
            dailyReminders: { email: true },
          },
        },
      });

      // dailyReminders.email updated, push unchanged
      expect(mockUser.settings.notifications.dailyReminders.email).toBe(true);
      expect(mockUser.settings.notifications.dailyReminders.push).toBe(true);
      // streakMilestones unchanged
      expect(mockUser.settings.notifications.streakMilestones.push).toBe(true);
      expect(mockUser.settings.notifications.streakMilestones.email).toBe(true);
    });

    it('should update reminder time', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: { theme: 'system', timezone: 'UTC', notifications: {}, reminderTime: '08:00' },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: { reminderTime: '09:30' },
      });

      expect(mockUser.settings.reminderTime).toBe('09:30');
    });
  });
});

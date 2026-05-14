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
    config: jest.fn().mockReturnValue({}),
    uploader: {
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
      upload_stream: jest.fn(),
    },
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: cloudinary } = await import('../../config/cloudinary.js');
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

    it('should update streakFreeze settings', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'system',
          timezone: 'UTC',
          notifications: {},
          reminderTime: '08:00',
          streakFreeze: { enabled: false, allowedPerMonth: 2 },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          streakFreeze: { enabled: true, allowedPerMonth: 5 },
        },
      });

      expect(mockUser.settings.streakFreeze.enabled).toBe(true);
      expect(mockUser.settings.streakFreeze.allowedPerMonth).toBe(5);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should partially update streakFreeze (only enabled)', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'system',
          timezone: 'UTC',
          notifications: {},
          reminderTime: '08:00',
          streakFreeze: { enabled: false, allowedPerMonth: 2 },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          streakFreeze: { enabled: true },
        },
      });

      expect(mockUser.settings.streakFreeze.enabled).toBe(true);
      expect(mockUser.settings.streakFreeze.allowedPerMonth).toBe(2); // unchanged
    });

    it('should partially update streakFreeze (only allowedPerMonth, no enabled)', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'system',
          timezone: 'UTC',
          notifications: {},
          reminderTime: '08:00',
          streakFreeze: { enabled: false, allowedPerMonth: 2 },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          streakFreeze: { allowedPerMonth: 10 },
        },
      });

      expect(mockUser.settings.streakFreeze.enabled).toBe(false); // unchanged
      expect(mockUser.settings.streakFreeze.allowedPerMonth).toBe(10);
    });

    it('should skip unknown notification types', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'dark',
          timezone: 'UTC',
          reminderTime: '08:00',
          notifications: {
            dailyReminders: { push: true, email: false },
          },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          notifications: {
            nonExistentType: { push: true, email: true },
          },
        },
      });

      // Should not crash, and the unknown type should not be added
      expect(mockUser.settings.notifications.nonExistentType).toBeUndefined();
      expect(mockUser.settings.notifications.dailyReminders.push).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should update only push channel in notifications', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: {
          theme: 'dark',
          timezone: 'UTC',
          reminderTime: '08:00',
          notifications: {
            dailyReminders: { push: false, email: true },
          },
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: {
          notifications: {
            dailyReminders: { push: true },
          },
        },
      });

      expect(mockUser.settings.notifications.dailyReminders.push).toBe(true);
      expect(mockUser.settings.notifications.dailyReminders.email).toBe(true); // unchanged
    });

    it('should update timezone setting', async () => {
      const mockUser = {
        _id: 'user1',
        name: 'John',
        settings: { theme: 'system', timezone: 'UTC', notifications: {}, reminderTime: '08:00' },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', {
        settings: { timezone: 'America/New_York' },
      });

      expect(mockUser.settings.timezone).toBe('America/New_York');
    });
  });

  describe('uploadAvatar', () => {
    it('should throw 503 if cloudinary is not configured', async () => {
      cloudinary.config.mockReturnValue({});

      await expect(
        userService.uploadAvatar('user1', Buffer.from('fake'))
      ).rejects.toMatchObject({
        message: 'Avatar upload is not configured on this server',
        statusCode: 503,
      });
    });

    it('should throw 404 if user not found', async () => {
      cloudinary.config.mockReturnValue({ cloud_name: 'test-cloud' });
      User.findById.mockResolvedValue(null);

      await expect(
        userService.uploadAvatar('user1', Buffer.from('fake'))
      ).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should upload avatar and update user', async () => {
      cloudinary.config.mockReturnValue({ cloud_name: 'test-cloud' });
      const mockUser = {
        _id: 'user1',
        avatar: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      // Mock upload_stream to simulate successful upload
      const mockStream = { end: jest.fn() };
      cloudinary.uploader.upload_stream.mockImplementation((opts, callback) => {
        // Call callback with success on next tick
        process.nextTick(() => callback(null, { secure_url: 'https://cdn.example.com/avatar.jpg', public_id: 'avatars/abc123' }));
        return mockStream;
      });

      const result = await userService.uploadAvatar('user1', Buffer.from('image-data'));

      expect(mockStream.end).toHaveBeenCalledWith(Buffer.from('image-data'));
      expect(mockUser.avatar).toEqual({
        url: 'https://cdn.example.com/avatar.jpg',
        publicId: 'avatars/abc123',
      });
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(result).toEqual(mockUser);
    });

    it('should delete old avatar before uploading new one', async () => {
      cloudinary.config.mockReturnValue({ cloud_name: 'test-cloud' });
      const mockUser = {
        _id: 'user1',
        avatar: { url: 'https://cdn.example.com/old.jpg', publicId: 'avatars/old123' },
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      const mockStream = { end: jest.fn() };
      cloudinary.uploader.upload_stream.mockImplementation((opts, callback) => {
        process.nextTick(() => callback(null, { secure_url: 'https://cdn.example.com/new.jpg', public_id: 'avatars/new123' }));
        return mockStream;
      });

      await userService.uploadAvatar('user1', Buffer.from('image-data'));

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('avatars/old123');
    });

    it('should throw 500 if cloudinary upload fails', async () => {
      cloudinary.config.mockReturnValue({ cloud_name: 'test-cloud' });
      const mockUser = {
        _id: 'user1',
        avatar: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.findById.mockResolvedValue(mockUser);

      const mockStream = { end: jest.fn() };
      cloudinary.uploader.upload_stream.mockImplementation((opts, callback) => {
        process.nextTick(() => callback(new Error('Upload failed'), null));
        return mockStream;
      });

      await expect(
        userService.uploadAvatar('user1', Buffer.from('image-data'))
      ).rejects.toMatchObject({
        message: 'Avatar upload failed',
        statusCode: 500,
      });
    });
  });
});

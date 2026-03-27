import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
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
      const mockUser = { _id: 'user1', name: 'Updated' };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await userService.updateProfile('user1', {
        name: 'Updated',
        email: 'hacker@evil.com', // should be filtered out
        role: 'admin', // should be filtered out
        settings: { theme: 'dark' },
      });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        { name: 'Updated', settings: { theme: 'dark' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw 404 if user not found during update', async () => {
      User.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        userService.updateProfile('nonexistent', { name: 'Test' })
      ).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should handle empty updates (no allowed fields)', async () => {
      const mockUser = { _id: 'user1', name: 'John' };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      await userService.updateProfile('user1', { email: 'test@test.com' });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        {},
        { new: true, runValidators: true }
      );
    });
  });
});

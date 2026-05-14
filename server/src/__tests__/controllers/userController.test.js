import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/userService.js', () => ({
  default: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
  },
}));

const { default: userService } = await import('../../services/userService.js');
const { getProfile, updateProfile, uploadAvatar } = await import('../../controllers/userController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('UserController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = { _id: 'u1', name: 'John', email: 'john@test.com' };
      userService.getProfile.mockResolvedValue(mockUser);

      const req = { user: { _id: 'u1' } };
      await getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { user: mockUser },
        })
      );
    });

    it('should pass errors to next', async () => {
      const error = new Error('User not found');
      userService.getProfile.mockRejectedValue(error);

      const req = { user: { _id: 'u1' } };
      await new Promise((resolve) => {
        getProfile(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      const mockUser = { _id: 'u1', name: 'Updated' };
      userService.updateProfile.mockResolvedValue(mockUser);

      const req = { user: { _id: 'u1' }, body: { name: 'Updated' } };
      await updateProfile(req, res, next);

      expect(userService.updateProfile).toHaveBeenCalledWith('u1', { name: 'Updated' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { user: mockUser },
          message: 'Profile updated',
        })
      );
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar and return updated user', async () => {
      const mockUser = { _id: 'u1', avatar: 'https://example.com/avatar.jpg' };
      userService.uploadAvatar.mockResolvedValue(mockUser);

      const req = { user: { _id: 'u1' }, file: { buffer: Buffer.from('image-data') } };
      await uploadAvatar(req, res, next);

      expect(userService.uploadAvatar).toHaveBeenCalledWith('u1', req.file.buffer);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Avatar updated',
          data: { user: mockUser },
        })
      );
    });

    it('should throw error when no file is provided', async () => {
      const req = { user: { _id: 'u1' } };
      await uploadAvatar(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });
  });
});

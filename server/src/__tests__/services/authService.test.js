import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before importing authService
jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    jwtSecret: 'test-secret-key-for-testing',
    jwtExpiresIn: '7d',
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: authService } = await import('../../services/authService.js');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should return a JWT string', () => {
      const token = authService.generateToken('user123');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('register', () => {
    it('should create user and return token', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'user123',
        name: 'John',
        email: 'john@example.com',
        role: 'user',
      });

      const result = await authService.register({
        name: 'John',
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.user.name).toBe('John');
      expect(result.user.email).toBe('john@example.com');
      expect(result.token).toBeDefined();
      expect(User.create).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'password123',
      });
    });

    it('should throw 400 if email already in use', async () => {
      User.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(
        authService.register({
          name: 'John',
          email: 'john@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({
        message: 'Email already in use',
        statusCode: 400,
      });
    });
  });

  describe('login', () => {
    it('should return user and token on valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'John',
        email: 'john@example.com',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await authService.login({
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('john@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw 401 if user not found', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.login({ email: 'noone@example.com', password: 'pass' })
      ).rejects.toMatchObject({
        message: 'Invalid email or password',
        statusCode: 401,
      });
    });

    it('should throw 401 if password does not match', async () => {
      const mockUser = {
        _id: 'user123',
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        authService.login({ email: 'john@example.com', password: 'wrong' })
      ).rejects.toMatchObject({
        message: 'Invalid email or password',
        statusCode: 401,
      });
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for existing user', async () => {
      const mockUser = {
        createPasswordResetToken: jest.fn().mockReturnValue('reset-token-abc'),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword('john@example.com');

      expect(result.resetToken).toBe('reset-token-abc');
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should throw 404 if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.forgotPassword('noone@example.com')
      ).rejects.toMatchObject({
        message: 'No account found with that email',
        statusCode: 404,
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      const mockUser = {
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.resetPassword('valid-token', 'newpass123');

      expect(result.message).toBe('Password reset successful');
      expect(mockUser.passwordHash).toBe('newpass123');
      expect(mockUser.resetPasswordToken).toBeUndefined();
      expect(mockUser.resetPasswordExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw 400 for invalid/expired token', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'newpass123')
      ).rejects.toMatchObject({
        message: 'Token is invalid or has expired',
        statusCode: 400,
      });
    });
  });
});

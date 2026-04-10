import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before importing authService
jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    jwtSecret: 'test-secret-key-for-testing',
    jwtExpiresIn: '7d',
    nodeEnv: 'test',
    clientUrl: 'http://localhost:5173',
    smtp: { host: '', user: '', pass: '', port: 587 },
    emailFrom: 'test@test.com',
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(),
    sendPasswordResetConfirmationEmail: jest.fn().mockResolvedValue(),
    sendPasswordChangedEmail: jest.fn().mockResolvedValue(),
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: emailService } = await import('../../services/emailService.js');
const { default: authService } = await import('../../services/authService.js');
const { default: AppError } = await import('../../utils/AppError.js');

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
        toJSON: () => ({
          _id: 'user123',
          name: 'John',
          email: 'john@example.com',
          role: 'user',
        }),
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

    it('should handle welcome email failure gracefully', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'user123',
        name: 'John',
        email: 'john@example.com',
        role: 'user',
        toJSON: () => ({
          _id: 'user123',
          name: 'John',
          email: 'john@example.com',
          role: 'user',
        }),
      });
      emailService.sendWelcomeEmail.mockRejectedValueOnce(new Error('SMTP down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await authService.register({
        name: 'John',
        email: 'john@example.com',
        password: 'password123',
      });

      // Registration should succeed even if email fails
      expect(result.user.name).toBe('John');
      expect(result.token).toBeDefined();

      // Allow the rejected promise .catch handler to execute
      await new Promise((r) => setTimeout(r, 0));
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Failed to send welcome email:',
        'SMTP down'
      );
      consoleSpy.mockRestore();
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
        toJSON: () => ({
          _id: 'user123',
          name: 'John',
          email: 'john@example.com',
          role: 'user',
        }),
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
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('john@example.com', 'reset-token-abc');
    });

    it('should return null token if user not found (no email enumeration)', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await authService.forgotPassword('noone@example.com');
      expect(result).toEqual({ resetToken: null });
    });

    it('should reset token fields and throw 500 if email delivery fails', async () => {
      const mockUser = {
        createPasswordResetToken: jest.fn().mockReturnValue('reset-token-abc'),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);
      emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('Email service not configured'));

      await expect(authService.forgotPassword('john@example.com')).rejects.toMatchObject({
        message: 'There was an error sending the email. Try again later.',
        statusCode: 500,
      });

      expect(mockUser.save).toHaveBeenNthCalledWith(1, { validateBeforeSave: false });
      expect(mockUser.save).toHaveBeenNthCalledWith(2, { validateBeforeSave: false });
      expect(mockUser.resetPasswordToken).toBeUndefined();
      expect(mockUser.resetPasswordExpires).toBeUndefined();
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

    it('should send confirmation email after successful reset', async () => {
      const mockUser = {
        email: 'john@example.com',
        name: 'John',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      await authService.resetPassword('valid-token', 'newpass123');

      expect(emailService.sendPasswordResetConfirmationEmail).toHaveBeenCalledWith(
        'john@example.com',
        'John'
      );
    });

    it('should handle confirmation email failure gracefully', async () => {
      const mockUser = {
        email: 'john@example.com',
        name: 'John',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);
      emailService.sendPasswordResetConfirmationEmail.mockRejectedValueOnce(new Error('SMTP down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await authService.resetPassword('valid-token', 'newpass123');

      expect(result.message).toBe('Password reset successful');

      // Allow the rejected promise .catch handler to execute
      await new Promise((r) => setTimeout(r, 0));
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Failed to send reset confirmation email:',
        'SMTP down'
      );
      consoleSpy.mockRestore();
    });

    it('should set passwordChangedAt on successful reset', async () => {
      const mockUser = {
        email: 'john@example.com',
        name: 'John',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      await authService.resetPassword('valid-token', 'newpass123');

      expect(mockUser.passwordChangedAt).toBeInstanceOf(Date);
    });
  });

  describe('changePassword', () => {
    it('should change password and return new token', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'john@example.com',
        name: 'John',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await authService.changePassword('user123', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(result.token).toBeDefined();
      expect(result.token.split('.')).toHaveLength(3);
      expect(mockUser.passwordHash).toBe('newpass123');
      expect(mockUser.passwordChangedAt).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw 404 if user not found', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.changePassword('nonexistent', {
          currentPassword: 'oldpass',
          newPassword: 'newpass123',
        })
      ).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should throw 401 if current password is incorrect', async () => {
      const mockUser = {
        _id: 'user123',
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        authService.changePassword('user123', {
          currentPassword: 'wrongpass',
          newPassword: 'newpass123',
        })
      ).rejects.toMatchObject({
        message: 'Current password is incorrect',
        statusCode: 401,
      });
    });

    it('should throw 400 if new password is the same as current password', async () => {
      const mockUser = {
        _id: 'user123',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        authService.changePassword('user123', {
          currentPassword: 'samepass',
          newPassword: 'samepass',
        })
      ).rejects.toMatchObject({
        message: 'New password must be different from current password',
        statusCode: 400,
      });
    });

    it('should handle password changed email failure gracefully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'john@example.com',
        name: 'John',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      emailService.sendPasswordChangedEmail.mockRejectedValueOnce(new Error('SMTP down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await authService.changePassword('user123', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(result.token).toBeDefined();

      // Allow the rejected promise .catch handler to execute
      await new Promise((r) => setTimeout(r, 0));
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Failed to send password changed email:',
        'SMTP down'
      );
      consoleSpy.mockRestore();
    });

    it('should send password changed notification email', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'john@example.com',
        name: 'John',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await authService.changePassword('user123', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'john@example.com',
        'John'
      );
    });
  });
});

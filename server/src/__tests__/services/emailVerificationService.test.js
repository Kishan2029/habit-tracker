import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    sendEmailVerificationEmail: jest.fn(),
  },
}));

const { default: User } = await import('../../models/User.js');
const { default: emailService } = await import('../../services/emailService.js');
const { default: emailVerificationService } = await import('../../services/emailVerificationService.js');

describe('EmailVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerification', () => {
    it('should throw 404 if user not found', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(emailVerificationService.sendVerification('u1')).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should throw 400 if email is already verified', async () => {
      const user = {
        _id: 'u1',
        emailVerified: true,
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.sendVerification('u1')).rejects.toMatchObject({
        message: 'Email is already verified',
        statusCode: 400,
      });
    });

    it('should enforce resend cooldown using the hidden expiry field', async () => {
      const user = {
        _id: 'u1',
        email: 'user@test.com',
        name: 'User',
        emailVerified: false,
        emailVerificationExpires: new Date(Date.now() + (9 * 60 * 1000) + 30 * 1000),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.sendVerification('u1')).rejects.toMatchObject({
        message: 'Please wait before requesting another code',
        statusCode: 429,
      });
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('should send verification code successfully', async () => {
      const user = {
        _id: 'u1',
        email: 'user@test.com',
        name: 'User',
        emailVerified: false,
        emailVerificationExpires: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      emailService.sendEmailVerificationEmail.mockResolvedValue(true);

      const result = await emailVerificationService.sendVerification('u1');

      expect(result).toEqual({ message: 'Verification code sent' });
      expect(user.emailVerificationCode).toBeDefined();
      expect(user.emailVerificationExpires).toBeDefined();
      expect(user.emailVerificationAttempts).toBe(0);
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith('user@test.com', 'User', expect.any(String));
    });

    it('should allow resend when cooldown has expired', async () => {
      const user = {
        _id: 'u1',
        email: 'user@test.com',
        name: 'User',
        emailVerified: false,
        // Expiry far in the past means cooldown has passed
        emailVerificationExpires: new Date(Date.now() - 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      emailService.sendEmailVerificationEmail.mockResolvedValue(true);

      const result = await emailVerificationService.sendVerification('u1');

      expect(result).toEqual({ message: 'Verification code sent' });
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw 404 if user not found', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(emailVerificationService.verifyEmail('u1', '123456')).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should throw 400 if email is already verified', async () => {
      const user = {
        _id: 'u1',
        emailVerified: true,
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.verifyEmail('u1', '123456')).rejects.toMatchObject({
        message: 'Email is already verified',
        statusCode: 400,
      });
    });

    it('should throw 400 if no pending verification code exists', async () => {
      const user = {
        _id: 'u1',
        emailVerified: false,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.verifyEmail('u1', '123456')).rejects.toMatchObject({
        message: 'No verification code found. Please request a new one.',
        statusCode: 400,
      });
    });

    it('should throw 429 and clear code after 5 failed attempts', async () => {
      const user = {
        _id: 'u1',
        emailVerified: false,
        emailVerificationCode: 'somehash',
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
        emailVerificationAttempts: 5,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.verifyEmail('u1', '123456')).rejects.toMatchObject({
        message: 'Too many failed attempts. Please request a new code.',
        statusCode: 429,
      });
      expect(user.emailVerificationCode).toBeUndefined();
      expect(user.emailVerificationExpires).toBeUndefined();
      expect(user.emailVerificationAttempts).toBe(0);
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should throw 400 and clear code if verification code has expired', async () => {
      const user = {
        _id: 'u1',
        emailVerified: false,
        emailVerificationCode: 'somehash',
        emailVerificationExpires: new Date(Date.now() - 1000), // expired
        emailVerificationAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.verifyEmail('u1', '123456')).rejects.toMatchObject({
        message: 'Verification code has expired. Please request a new one.',
        statusCode: 400,
      });
      expect(user.emailVerificationCode).toBeUndefined();
      expect(user.emailVerificationExpires).toBeUndefined();
      expect(user.emailVerificationAttempts).toBe(0);
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should throw 400 and increment attempts on wrong code', async () => {
      const correctCode = '123456';
      const wrongCode = '654321';
      const hashedCorrectCode = emailVerificationService.hashCode(correctCode);

      const user = {
        _id: 'u1',
        emailVerified: false,
        emailVerificationCode: hashedCorrectCode,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
        emailVerificationAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(emailVerificationService.verifyEmail('u1', wrongCode)).rejects.toMatchObject({
        message: 'Invalid verification code',
        statusCode: 400,
      });
      expect(user.emailVerificationAttempts).toBe(1);
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should verify email successfully with correct code', async () => {
      const code = '123456';
      const hashedCode = emailVerificationService.hashCode(code);

      const user = {
        _id: 'u1',
        emailVerified: false,
        emailVerificationCode: hashedCode,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
        emailVerificationAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const result = await emailVerificationService.verifyEmail('u1', code);

      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(user.emailVerified).toBe(true);
      expect(user.emailVerificationCode).toBeUndefined();
      expect(user.emailVerificationExpires).toBeUndefined();
      expect(user.emailVerificationAttempts).toBe(0);
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });
});

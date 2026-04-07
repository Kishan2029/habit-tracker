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
  });
});

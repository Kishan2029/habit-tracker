import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/emailVerificationService.js', () => ({
  default: {
    sendVerification: jest.fn(),
    verifyEmail: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/responseFormatter.js', () => ({
  sendSuccess: jest.fn(),
}));

const { default: emailVerificationService } = await import('../../services/emailVerificationService.js');
const { sendSuccess } = await import('../../utils/responseFormatter.js');
const { sendVerification, verifyEmail } = await import('../../controllers/emailVerificationController.js');

describe('EmailVerificationController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {};
    next = jest.fn();
  });

  describe('sendVerification', () => {
    it('should call service with req.user._id and sendSuccess with result message', async () => {
      const mockResult = { message: 'Verification email sent' };
      emailVerificationService.sendVerification.mockResolvedValue(mockResult);

      const req = { user: { _id: 'u1' } };

      await sendVerification(req, res, next);

      expect(emailVerificationService.sendVerification).toHaveBeenCalledWith('u1');
      expect(sendSuccess).toHaveBeenCalledWith(res, null, 'Verification email sent');
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('Service error');
      emailVerificationService.sendVerification.mockRejectedValue(error);

      const req = { user: { _id: 'u1' } };

      await new Promise((resolve) => {
        sendVerification(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyEmail', () => {
    it('should call service with req.user._id and code, then sendSuccess with result message', async () => {
      const mockResult = { message: 'Email verified successfully' };
      emailVerificationService.verifyEmail.mockResolvedValue(mockResult);

      const req = { user: { _id: 'u1' }, body: { code: '123456' } };

      await verifyEmail(req, res, next);

      expect(emailVerificationService.verifyEmail).toHaveBeenCalledWith('u1', '123456');
      expect(sendSuccess).toHaveBeenCalledWith(res, null, 'Email verified successfully');
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('Invalid code');
      emailVerificationService.verifyEmail.mockRejectedValue(error);

      const req = { user: { _id: 'u1' }, body: { code: 'wrong' } };

      await new Promise((resolve) => {
        verifyEmail(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

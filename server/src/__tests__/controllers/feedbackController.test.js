import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/Feedback.js', () => ({
  default: {
    create: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    sendFeedbackNotification: jest.fn(),
  },
}));

const { default: Feedback } = await import('../../models/Feedback.js');
const { default: emailService } = await import('../../services/emailService.js');
const { submitFeedback } = await import('../../controllers/feedbackController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('FeedbackController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('submitFeedback', () => {
    it('should create feedback and return 201', async () => {
      const mockFeedback = { _id: 'f1' };
      Feedback.create.mockResolvedValue(mockFeedback);
      emailService.sendFeedbackNotification.mockResolvedValue();

      const req = {
        body: { mood: 'happy', message: 'Great app!', page: 'dashboard' },
        user: { _id: 'u1', name: 'John', email: 'john@test.com' },
      };

      await submitFeedback(req, res, next);

      expect(Feedback.create).toHaveBeenCalledWith({
        userId: 'u1',
        mood: 'happy',
        message: 'Great app!',
        page: 'dashboard',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Thank you for your feedback!',
          data: { id: 'f1' },
        })
      );
    });

    it('should still succeed if email notification fails', async () => {
      Feedback.create.mockResolvedValue({ _id: 'f1' });
      emailService.sendFeedbackNotification.mockRejectedValue(new Error('Email delivery failed'));

      const req = {
        body: { mood: 'sad', message: 'Bug found', page: 'habits' },
        user: { _id: 'u1', name: 'John', email: 'john@test.com' },
      };

      await submitFeedback(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should send email notification with correct parameters', async () => {
      Feedback.create.mockResolvedValue({ _id: 'f1' });
      emailService.sendFeedbackNotification.mockResolvedValue();

      const req = {
        body: { mood: 'loved', message: 'Amazing!', page: 'settings' },
        user: { _id: 'u1', name: 'Alice', email: 'alice@test.com' },
      };

      await submitFeedback(req, res, next);

      expect(emailService.sendFeedbackNotification).toHaveBeenCalledWith(
        'Alice', 'alice@test.com', 'loved', 'Amazing!', 'settings'
      );
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('DB error');
      Feedback.create.mockRejectedValue(error);

      const req = {
        body: { mood: 'happy', message: 'test', page: 'home' },
        user: { _id: 'u1', name: 'John', email: 'john@test.com' },
      };

      await new Promise((resolve) => {
        submitFeedback(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

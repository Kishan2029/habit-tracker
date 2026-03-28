import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/pushService.js', () => ({
  default: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  },
}));

const { default: pushService } = await import('../../services/pushService.js');
const { subscribe, unsubscribe } = await import('../../controllers/pushController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('PushController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('subscribe', () => {
    it('should subscribe and return 201', async () => {
      pushService.subscribe.mockResolvedValue({});
      const subscription = { endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } };
      const req = { body: { subscription }, user: { _id: 'u1' } };

      await subscribe(req, res, next);

      expect(pushService.subscribe).toHaveBeenCalledWith('u1', subscription);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Push notification subscription saved',
        })
      );
    });

    it('should return 400 if subscription is missing', async () => {
      const req = { body: {}, user: { _id: 'u1' } };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid subscription: endpoint and keys are required',
      });
      expect(pushService.subscribe).not.toHaveBeenCalled();
    });

    it('should return 400 if subscription has no endpoint', async () => {
      const req = { body: { subscription: { keys: { p256dh: 'k', auth: 'k' } } }, user: { _id: 'u1' } };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(pushService.subscribe).not.toHaveBeenCalled();
    });

    it('should return 400 if subscription has no keys', async () => {
      const req = { body: { subscription: { endpoint: 'https://push.example.com' } }, user: { _id: 'u1' } };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(pushService.subscribe).not.toHaveBeenCalled();
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('DB error');
      pushService.subscribe.mockRejectedValue(error);
      const subscription = { endpoint: 'https://push.example.com', keys: { p256dh: 'k', auth: 'k' } };
      const req = { body: { subscription }, user: { _id: 'u1' } };

      await new Promise((resolve) => {
        subscribe(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe and return 200', async () => {
      pushService.unsubscribe.mockResolvedValue({});
      const req = { user: { _id: 'u1' } };

      await unsubscribe(req, res, next);

      expect(pushService.unsubscribe).toHaveBeenCalledWith('u1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Push notification subscription removed',
        })
      );
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('DB error');
      pushService.unsubscribe.mockRejectedValue(error);
      const req = { user: { _id: 'u1' } };

      await new Promise((resolve) => {
        unsubscribe(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

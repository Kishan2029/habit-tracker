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
    it('should save subscription and return 201', async () => {
      pushService.subscribe.mockResolvedValue({});

      const req = {
        user: { _id: 'u1' },
        body: {
          subscription: { endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } },
        },
      };

      await subscribe(req, res, next);

      expect(pushService.subscribe).toHaveBeenCalledWith('u1', req.body.subscription);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if subscription is missing', async () => {
      const req = { user: { _id: 'u1' }, body: {} };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should return 400 if subscription has no endpoint', async () => {
      const req = {
        user: { _id: 'u1' },
        body: { subscription: { keys: { p256dh: 'k', auth: 'k' } } },
      };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if subscription has no keys', async () => {
      const req = {
        user: { _id: 'u1' },
        body: { subscription: { endpoint: 'https://push.example.com' } },
      };

      await subscribe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscription', async () => {
      pushService.unsubscribe.mockResolvedValue({});

      const req = { user: { _id: 'u1' } };

      await unsubscribe(req, res, next);

      expect(pushService.unsubscribe).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Push notification subscription removed' })
      );
    });
  });
});

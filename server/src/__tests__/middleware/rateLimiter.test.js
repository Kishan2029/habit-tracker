import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import rateLimiter from '../../middleware/rateLimiter.js';

describe('rateLimiter middleware', () => {
  let res, next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should allow requests within the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 5 });
    const req = { ip: '192.168.1.100' };

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 429 when limit exceeded', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 2 });
    const req = { ip: '10.0.0.1' };

    limiter(req, res, next); // 1st
    limiter(req, res, next); // 2nd
    limiter(req, res, next); // 3rd - over limit

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Too many requests, please try again later',
      })
    );
  });

  it('should track different IPs separately', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 1 });

    limiter({ ip: '1.1.1.1' }, res, next);
    limiter({ ip: '2.2.2.2' }, res, next);

    // Both should succeed since they're different IPs
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should use default values when no options provided', () => {
    const limiter = rateLimiter();
    const req = { ip: '3.3.3.3' };

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

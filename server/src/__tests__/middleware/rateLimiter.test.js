import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('rateLimiter cleanup interval', () => {
  let rateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should clean up expired entries when the cleanup interval fires', async () => {
    // Reset module cache so the module re-executes with fake timers active
    jest.resetModules();
    const mod = await import('../../middleware/rateLimiter.js');
    rateLimiter = mod.default;

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();

    // Create a limiter with a short window
    const limiter = rateLimiter({ windowMs: 1000, max: 1 });

    // Make a request to populate the store
    limiter({ ip: '99.99.99.99' }, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second request should exceed limit
    limiter({ ip: '99.99.99.99' }, res, next);
    expect(res.status).toHaveBeenCalledWith(429);

    // Advance time past windowMs (1s) and past cleanup interval (60s)
    jest.advanceTimersByTime(61 * 1000);

    // After cleanup, the expired entry should be deleted.
    // A new request should be treated as the first (fresh record).
    const next2 = jest.fn();
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    limiter({ ip: '99.99.99.99' }, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(res2.status).not.toHaveBeenCalled();
  });
});

describe('rateLimiter middleware', () => {
  let rateLimiter;
  let res, next;

  beforeEach(async () => {
    const mod = await import('../../middleware/rateLimiter.js');
    rateLimiter = mod.default;

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

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should use default values when no options provided', () => {
    const limiter = rateLimiter();
    const req = { ip: '3.3.3.3' };

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

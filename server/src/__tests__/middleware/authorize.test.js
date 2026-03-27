import { describe, it, expect, jest } from '@jest/globals';
import authorize from '../../middleware/authorize.js';

describe('authorize middleware', () => {
  it('should call next if user role is in allowed roles', () => {
    const middleware = authorize('admin', 'premium');
    const req = { user: { role: 'admin' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with 403 error if user role not allowed', () => {
    const middleware = authorize('admin');
    const req = { user: { role: 'user' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'You do not have permission to perform this action',
        statusCode: 403,
      })
    );
  });

  it('should handle multiple allowed roles', () => {
    const middleware = authorize('user', 'premium', 'admin');
    const req = { user: { role: 'premium' } };
    const next = jest.fn();

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    nodeEnv: 'production',
  },
}));

const { default: errorHandler } = await import('../../middleware/errorHandler.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler middleware', () => {
  let res, next;

  beforeEach(() => {
    res = createMockRes();
    next = jest.fn();
  });

  it('should handle generic errors with 500 status', () => {
    const err = new Error('Something went wrong');
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong',
      })
    );
  });

  it('should use error statusCode if provided', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should handle Mongoose duplicate key error (11000)', () => {
    const err = { code: 11000, keyValue: { email: 'test@test.com' } };
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Duplicate value for email. Please use another value.',
      })
    );
  });

  it('should handle Mongoose ValidationError', () => {
    const err = {
      name: 'ValidationError',
      errors: {
        name: { message: 'Name is required' },
        email: { message: 'Email is required' },
      },
    };
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Name is required. Email is required',
      })
    );
  });

  it('should handle Mongoose CastError', () => {
    const err = { name: 'CastError', path: '_id', value: 'invalid-id' };
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid _id: invalid-id',
      })
    );
  });

  it('should handle JsonWebTokenError', () => {
    const err = { name: 'JsonWebTokenError', message: 'jwt malformed' };
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid token' })
    );
  });

  it('should handle TokenExpiredError', () => {
    const err = { name: 'TokenExpiredError', message: 'jwt expired' };
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token expired' })
    );
  });

  it('should not include stack in production', () => {
    const err = new Error('fail');
    err.statusCode = 500;
    errorHandler(err, {}, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeUndefined();
  });
});

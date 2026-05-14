import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    jwtSecret: 'test-secret',
  },
}));

const { default: jwt } = await import('jsonwebtoken');
const { default: User } = await import('../../models/User.js');
const { default: authenticate } = await import('../../middleware/authenticate.js');

describe('authenticate middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {} };
    res = {};
    next = jest.fn();
  });

  it('should call next with error if no Authorization header', async () => {
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not authorized, no token provided',
        statusCode: 401,
      })
    );
  });

  it('should call next with error if Authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'Token abc123';
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('should call next with error if token is invalid', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockImplementation(() => { throw new Error('bad token'); });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not authorized, token invalid',
        statusCode: 401,
      })
    );
  });

  it('should call next with error if user no longer exists', async () => {
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user1' });
    User.findById.mockResolvedValue(null);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'User belonging to this token no longer exists',
        statusCode: 401,
      })
    );
  });

  it('should attach user to req and call next on success', async () => {
    const mockUser = { _id: 'user1', name: 'John' };
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user1' });
    User.findById.mockResolvedValue(mockUser);

    await authenticate(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledWith();
  });

  it('should allow access when passwordChangedAt is before token issue time', async () => {
    const mockUser = {
      _id: 'user1',
      name: 'John',
      passwordChangedAt: new Date('2024-01-01T00:00:00Z'),
    };
    req.headers.authorization = 'Bearer valid-token';
    // iat is in seconds; set it after passwordChangedAt
    jwt.verify.mockReturnValue({ id: 'user1', iat: Math.floor(new Date('2024-06-01').getTime() / 1000) });
    User.findById.mockResolvedValue(mockUser);

    await authenticate(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject access when passwordChangedAt is after token issue time', async () => {
    const mockUser = {
      _id: 'user1',
      name: 'John',
      passwordChangedAt: new Date('2024-06-01T00:00:00Z'),
    };
    req.headers.authorization = 'Bearer valid-token';
    // iat is in seconds; set it before passwordChangedAt
    jwt.verify.mockReturnValue({ id: 'user1', iat: Math.floor(new Date('2024-01-01').getTime() / 1000) });
    User.findById.mockResolvedValue(mockUser);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Password recently changed. Please log in again.',
        statusCode: 401,
      })
    );
  });
});

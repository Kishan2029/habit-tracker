import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/authService.js', () => ({
  default: {
    register: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  },
}));

const { default: authService } = await import('../../services/authService.js');
const { register, login, forgotPassword, resetPassword, changePassword } = await import(
  '../../controllers/authController.js'
);

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('register', () => {
    it('should register user and return 201', async () => {
      const mockResult = {
        user: { _id: 'u1', name: 'John', email: 'john@test.com' },
        token: 'jwt-token',
      };
      authService.register.mockResolvedValue(mockResult);

      const req = { body: { name: 'John', email: 'john@test.com', password: 'pass123' } };
      // catchAsync wraps it, so we call the inner function
      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User registered successfully',
          data: mockResult,
        })
      );
    });

    it('should pass errors to next via catchAsync', async () => {
      const error = new Error('Email already in use');
      authService.register.mockRejectedValue(error);

      const req = { body: { name: 'John', email: 'john@test.com', password: 'pass123' } };
      // catchAsync returns a function that returns a Promise; we must await it
      const handler = register;
      await new Promise((resolve) => {
        handler(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('should login user and return 200', async () => {
      const mockResult = {
        user: { _id: 'u1', email: 'john@test.com' },
        token: 'jwt-token',
      };
      authService.login.mockResolvedValue(mockResult);

      const req = { body: { email: 'john@test.com', password: 'pass123' } };
      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful',
        })
      );
    });
  });

  describe('forgotPassword', () => {
    it('should never return reset token in response', async () => {
      authService.forgotPassword.mockResolvedValue({ resetToken: 'abc123' });

      const req = { body: { email: 'john@test.com' } };
      await forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {},
        })
      );
    });

    it('should not return reset token in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      authService.forgotPassword.mockResolvedValue({ resetToken: 'abc123' });

      const req = { body: { email: 'john@test.com' } };
      await forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {},
        })
      );
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('resetPassword', () => {
    it('should reset password and return success', async () => {
      authService.resetPassword.mockResolvedValue({});

      const req = { body: { token: 'reset-token', newPassword: 'newpass123' } };
      await resetPassword(req, res, next);

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'newpass123');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('changePassword', () => {
    it('should change password and return token', async () => {
      const mockResult = { token: 'new-jwt-token' };
      authService.changePassword.mockResolvedValue(mockResult);

      const req = {
        user: { _id: 'u1' },
        body: { currentPassword: 'oldpass', newPassword: 'newpass123' },
      };
      await changePassword(req, res, next);

      expect(authService.changePassword).toHaveBeenCalledWith('u1', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully',
          data: { token: 'new-jwt-token' },
        })
      );
    });
  });
});

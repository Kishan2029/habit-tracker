import { describe, it, expect, jest } from '@jest/globals';
import { sendSuccess, sendError } from '../../utils/responseFormatter.js';

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('responseFormatter', () => {
  describe('sendSuccess', () => {
    it('should send success response with defaults', () => {
      const res = createMockRes();
      sendSuccess(res, { id: 1 });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data: { id: 1 },
      });
    });

    it('should send custom message and status code', () => {
      const res = createMockRes();
      sendSuccess(res, { id: 1 }, 'Created', 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Created',
        data: { id: 1 },
      });
    });

    it('should include meta when provided', () => {
      const res = createMockRes();
      const meta = { page: 1, total: 50 };
      sendSuccess(res, [], 'Success', 200, meta);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data: [],
        meta,
      });
    });

    it('should not include meta when null', () => {
      const res = createMockRes();
      sendSuccess(res, {});

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('meta');
    });
  });

  describe('sendError', () => {
    it('should send error response with defaults', () => {
      const res = createMockRes();
      sendError(res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error',
      });
    });

    it('should send custom error message and status', () => {
      const res = createMockRes();
      sendError(res, 'Not found', 404);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not found',
      });
    });

    it('should include errors array when provided', () => {
      const res = createMockRes();
      const errors = [{ field: 'email', message: 'Invalid email' }];
      sendError(res, 'Validation failed', 400, errors);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors,
      });
    });

    it('should not include errors when null', () => {
      const res = createMockRes();
      sendError(res, 'Bad request', 400);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('errors');
    });
  });
});

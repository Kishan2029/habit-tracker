import { describe, it, expect } from '@jest/globals';
import AppError from '../../utils/AppError.js';

describe('AppError', () => {
  it('should create an error with message and statusCode', () => {
    const error = new AppError('Not found', 404);
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Bad request', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a stack trace', () => {
    const error = new AppError('Server error', 500);
    expect(error.stack).toBeDefined();
  });

  it('should handle different status codes', () => {
    const cases = [
      { msg: 'Unauthorized', code: 401 },
      { msg: 'Forbidden', code: 403 },
      { msg: 'Conflict', code: 409 },
    ];
    for (const { msg, code } of cases) {
      const err = new AppError(msg, code);
      expect(err.message).toBe(msg);
      expect(err.statusCode).toBe(code);
    }
  });
});

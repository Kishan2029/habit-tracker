import { describe, it, expect, jest } from '@jest/globals';
import catchAsync from '../../utils/catchAsync.js';

describe('catchAsync', () => {
  it('should call the wrapped function with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const req = {};
    const res = {};
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('should call next with error when async function rejects', async () => {
    const error = new Error('Something went wrong');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should not call next when function resolves successfully', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped({}, {}, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should catch synchronous errors thrown inside async functions', async () => {
    const error = new Error('Sync throw');
    const fn = jest.fn().mockImplementation(async () => {
      throw error;
    });
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

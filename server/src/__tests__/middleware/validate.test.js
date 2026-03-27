import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(),
}));

const { validationResult } = await import('express-validator');
const { default: validate } = await import('../../middleware/validate.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('validate middleware', () => {
  it('should call next when no validation errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
    });
    const next = jest.fn();

    validate({}, createMockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 400 with validation errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'email', msg: 'Email is required' },
        { path: 'password', msg: 'Password must be at least 6 characters' },
      ],
    });

    const res = createMockRes();
    const next = jest.fn();

    validate({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password must be at least 6 characters' },
        ],
      })
    );
  });
});

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('multer', () => {
  const multerInstance = {
    single: jest.fn(),
    array: jest.fn(),
  };
  const multerFn = jest.fn(() => multerInstance);
  multerFn.memoryStorage = jest.fn(() => 'memoryStorage');
  return { default: multerFn };
});

const { default: multer } = await import('multer');
const { default: upload } = await import('../../middleware/upload.js');

describe('Upload Middleware', () => {
  it('should use memory storage', () => {
    expect(multer.memoryStorage).toHaveBeenCalled();
  });

  it('should configure multer with correct options', () => {
    expect(multer).toHaveBeenCalledWith(
      expect.objectContaining({
        storage: 'memoryStorage',
        limits: { fileSize: 5 * 1024 * 1024 },
      })
    );
  });

  it('should accept image files in fileFilter', () => {
    const config = multer.mock.calls[0][0];
    const fileFilter = config.fileFilter;

    const cb = jest.fn();
    fileFilter({}, { mimetype: 'image/png' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);

    cb.mockClear();
    fileFilter({}, { mimetype: 'image/jpeg' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('should reject non-image files in fileFilter', () => {
    const config = multer.mock.calls[0][0];
    const fileFilter = config.fileFilter;

    const cb = jest.fn();
    fileFilter({}, { mimetype: 'application/pdf' }, cb);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Only image files are allowed', statusCode: 400 }),
      false
    );
  });

  it('should reject text files', () => {
    const config = multer.mock.calls[0][0];
    const fileFilter = config.fileFilter;

    const cb = jest.fn();
    fileFilter({}, { mimetype: 'text/plain' }, cb);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Only image files are allowed' }),
      false
    );
  });
});

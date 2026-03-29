import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('multer', () => {
  const multerInstance = {
    single: jest.fn(),
    array: jest.fn(),
    fields: jest.fn(),
    none: jest.fn(),
  };
  const multerFn = jest.fn(() => multerInstance);
  multerFn.memoryStorage = jest.fn(() => 'memoryStorage');
  return { default: multerFn };
});

const { default: multer } = await import('multer');

// Import after mocking to capture the config
await import('../../middleware/upload.js');

describe('Upload Middleware', () => {
  it('should use memory storage', () => {
    expect(multer.memoryStorage).toHaveBeenCalled();
  });

  it('should configure multer with 5MB file size limit', () => {
    expect(multer).toHaveBeenCalledWith(
      expect.objectContaining({
        limits: { fileSize: 5 * 1024 * 1024 },
      })
    );
  });

  it('should configure a file filter', () => {
    const config = multer.mock.calls[0][0];
    expect(config.fileFilter).toBeDefined();
  });

  describe('fileFilter', () => {
    let fileFilter;

    beforeEach(() => {
      fileFilter = multer.mock.calls[0][0].fileFilter;
    });

    it('should accept image files', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/png' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should accept jpeg images', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/jpeg' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should reject non-image files', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'application/pdf' }, cb);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only image files are allowed' }),
        false
      );
    });

    it('should reject text files', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'text/plain' }, cb);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
        false
      );
    });
  });
});

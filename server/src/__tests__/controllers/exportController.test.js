import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/exportService.js', () => ({
  default: {
    generateExcel: jest.fn(),
    generatePDF: jest.fn(),
  },
}));

const { default: exportService } = await import('../../services/exportService.js');
const { exportExcel, exportPDF } = await import('../../controllers/exportController.js');

describe('ExportController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('exportExcel', () => {
    it('should generate and send Excel buffer', async () => {
      const buffer = new ArrayBuffer(10);
      exportService.generateExcel.mockResolvedValue(buffer);

      const req = { user: { _id: 'u1' }, query: { start: '2025-01-01', end: '2025-01-31' } };
      await exportExcel(req, res, next);

      expect(exportService.generateExcel).toHaveBeenCalledWith('u1', '2025-01-01', '2025-01-31');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=habits-2025-01-01-to-2025-01-31.xlsx'
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw when start or end is missing', async () => {
      const req = { user: { _id: 'u1' }, query: { end: '2025-01-31' } };
      await exportExcel(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should throw when start is after end', async () => {
      const req = { user: { _id: 'u1' }, query: { start: '2025-01-31', end: '2025-01-01' } };
      await exportExcel(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should pass errors to next', async () => {
      const error = new Error('Export failed');
      exportService.generateExcel.mockRejectedValue(error);

      const req = { user: { _id: 'u1' }, query: { start: '2025-01-01', end: '2025-01-31' } };
      await new Promise((resolve) => {
        exportExcel(req, res, (err) => {
          next(err);
          resolve();
        });
      });

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('exportPDF', () => {
    it('should throw when start or end is missing', async () => {
      const req = { user: { _id: 'u1' }, query: { start: '2025-01-01' } };
      await exportPDF(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should throw when start is after end', async () => {
      const req = { user: { _id: 'u1' }, query: { start: '2025-12-31', end: '2025-01-01' } };
      await exportPDF(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should generate and send PDF buffer', async () => {
      const buffer = Buffer.from('pdf-content');
      exportService.generatePDF.mockResolvedValue(buffer);

      const req = { user: { _id: 'u1' }, query: { start: '2025-01-01', end: '2025-01-31' } };
      await exportPDF(req, res, next);

      expect(exportService.generatePDF).toHaveBeenCalledWith('u1', '2025-01-01', '2025-01-31');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=habits-2025-01-01-to-2025-01-31.pdf'
      );
      expect(res.send).toHaveBeenCalledWith(buffer);
    });
  });
});

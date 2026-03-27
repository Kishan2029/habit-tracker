import catchAsync from '../utils/catchAsync.js';
import exportService from '../services/exportService.js';
import AppError from '../utils/AppError.js';

export const exportExcel = catchAsync(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) throw new AppError('start and end query parameters are required', 400);
  if (start > end) throw new AppError('start date must be before or equal to end date', 400);

  const buffer = await exportService.generateExcel(req.user._id, start, end);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=habits-${start}-to-${end}.xlsx`);
  res.send(Buffer.from(buffer));
});

export const exportPDF = catchAsync(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) throw new AppError('start and end query parameters are required', 400);
  if (start > end) throw new AppError('start date must be before or equal to end date', 400);

  const pdfBuffer = await exportService.generatePDF(req.user._id, start, end);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=habits-${start}-to-${end}.pdf`);
  res.send(pdfBuffer);
});

import catchAsync from '../utils/catchAsync.js';
import exportService from '../services/exportService.js';

export const exportExcel = catchAsync(async (req, res) => {
  const { start, end } = req.query;
  const buffer = await exportService.generateExcel(req.user._id, start, end);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=habits-${start}-to-${end}.xlsx`);
  res.send(Buffer.from(buffer));
});

export const exportPDF = catchAsync(async (req, res) => {
  const { start, end } = req.query;
  const pdfBuffer = await exportService.generatePDF(req.user._id, start, end);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=habits-${start}-to-${end}.pdf`);
  res.send(pdfBuffer);
});

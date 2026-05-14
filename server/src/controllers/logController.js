import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import logService from '../services/logService.js';
import correlationService from '../services/correlationService.js';
import AppError from '../utils/AppError.js';
import { INSIGHTS_DEFAULT_WINDOW_DAYS } from '../config/constants.js';

export const createOrUpdateLog = catchAsync(async (req, res) => {
  const timezone = req.user.settings?.timezone || null;
  const { log, isNew } = await logService.createOrUpdate(req.user._id, req.body, timezone);
  sendSuccess(res, { log }, isNew ? 'Log created' : 'Log updated', isNew ? 201 : 200);
});

export const getDailyLogs = catchAsync(async (req, res) => {
  const timezone = req.user.settings?.timezone || null;
  const data = await logService.getDailyLogs(req.user._id, req.query.date, timezone);
  sendSuccess(res, data, 'Daily logs retrieved');
});

export const getMonthlyLogs = catchAsync(async (req, res) => {
  const month = parseInt(req.query.month, 10);
  const year = parseInt(req.query.year, 10);
  if (isNaN(month) || isNaN(year)) throw new AppError('Valid month and year are required', 400);
  const timezone = req.user.settings?.timezone || null;
  const data = await logService.getMonthlyLogs(req.user._id, month, year, timezone);
  sendSuccess(res, data, 'Monthly logs retrieved');
});

export const getYearlyLogs = catchAsync(async (req, res) => {
  const year = parseInt(req.query.year, 10);
  if (isNaN(year)) throw new AppError('Valid year is required', 400);
  const timezone = req.user.settings?.timezone || null;
  const data = await logService.getYearlyLogs(req.user._id, year, timezone);
  sendSuccess(res, data, 'Yearly logs retrieved');
});

export const getRangeLogs = catchAsync(async (req, res) => {
  const timezone = req.user.settings?.timezone || null;
  const data = await logService.getRangeLogs(req.user._id, req.query.start, req.query.end, timezone);
  sendSuccess(res, data, 'Range logs retrieved');
});

export const getLeaderboard = catchAsync(async (req, res) => {
  const range = req.query.range || 'week';
  if (!['week', 'month'].includes(range)) throw new AppError('range must be "week" or "month"', 400);
  const timezone = req.user.settings?.timezone || null;
  const data = await logService.getLeaderboard(req.user._id, req.params.habitId, range, timezone);
  sendSuccess(res, data, 'Leaderboard retrieved');
});

export const getInsights = catchAsync(async (req, res) => {
  // insightsQueryRules validator already ran .toInt(), so req.query.days is a safe integer or undefined
  const windowDays = req.query.days ?? INSIGHTS_DEFAULT_WINDOW_DAYS;
  const timezone = req.user.settings?.timezone || null;
  const data = await correlationService.getInsights(req.user._id, { windowDays, timezone });
  sendSuccess(res, data, 'Insights retrieved');
});

export const getMembersProgress = catchAsync(async (req, res) => {
  const date = req.query.date;
  if (!date) throw new AppError('date query parameter is required', 400);
  const data = await logService.getMembersProgress(req.user._id, req.params.habitId, date);
  sendSuccess(res, data, 'Members progress retrieved');
});

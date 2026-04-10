import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import habitService from '../services/habitService.js';
import streakFreezeService from '../services/streakFreezeService.js';

export const getHabits = catchAsync(async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const category = req.query.category || undefined;
  const habits = await habitService.getAll(req.user._id, { includeArchived, category });
  sendSuccess(res, { habits }, 'Habits retrieved');
});

export const getHabit = catchAsync(async (req, res) => {
  const habit = await habitService.getById(req.params.id, req.user._id);
  sendSuccess(res, { habit }, 'Habit retrieved');
});

export const createHabit = catchAsync(async (req, res) => {
  const habit = await habitService.create(req.user._id, req.body);
  sendSuccess(res, { habit }, 'Habit created', 201);
});

export const updateHabit = catchAsync(async (req, res) => {
  const habit = await habitService.update(req.params.id, req.user._id, req.body);
  sendSuccess(res, { habit }, 'Habit updated');
});

export const archiveHabit = catchAsync(async (req, res) => {
  const habit = await habitService.archive(req.params.id, req.user._id);
  sendSuccess(res, { habit }, 'Habit archived');
});

export const unarchiveHabit = catchAsync(async (req, res) => {
  const habit = await habitService.unarchive(req.params.id, req.user._id);
  sendSuccess(res, { habit }, 'Habit unarchived');
});

export const deleteHabit = catchAsync(async (req, res) => {
  const result = await habitService.delete(req.params.id, req.user._id);
  sendSuccess(res, result, 'Habit deleted');
});

export const reorderHabits = catchAsync(async (req, res) => {
  const result = await habitService.reorder(req.user._id, req.body.items);
  sendSuccess(res, result, 'Habits reordered');
});

export const freezeDay = catchAsync(async (req, res) => {
  const data = await streakFreezeService.useFreeze(req.user._id, req.params.id, req.body.date);
  sendSuccess(res, data, 'Day frozen');
});

export const getFreezeStatus = catchAsync(async (req, res) => {
  const data = await streakFreezeService.getFreezeStatus(req.user._id, req.params.id);
  sendSuccess(res, data, 'Freeze status retrieved');
});

export const getBatchFreezeStatus = catchAsync(async (req, res) => {
  const ids = req.query.ids?.split(',').filter(Boolean) || [];
  if (ids.length === 0) return sendSuccess(res, {}, 'No habits specified');
  if (ids.length > 50) return sendSuccess(res, {}, 'Too many habits (max 50)');
  const data = await streakFreezeService.getBatchFreezeStatus(req.user._id, ids);
  sendSuccess(res, data, 'Batch freeze status retrieved');
});

import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import pushService from '../services/pushService.js';

export const subscribe = catchAsync(async (req, res) => {
  const { subscription } = req.body;
  await pushService.subscribe(req.user._id, subscription);
  sendSuccess(res, {}, 'Push notification subscription saved', 201);
});

export const unsubscribe = catchAsync(async (req, res) => {
  await pushService.unsubscribe(req.user._id);
  sendSuccess(res, {}, 'Push notification subscription removed');
});

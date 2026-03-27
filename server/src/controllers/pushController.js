import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import pushService from '../services/pushService.js';

export const subscribe = catchAsync(async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ success: false, message: 'Invalid subscription: endpoint and keys are required' });
  }
  await pushService.subscribe(req.user._id, subscription);
  sendSuccess(res, {}, 'Push notification subscription saved', 201);
});

export const unsubscribe = catchAsync(async (req, res) => {
  await pushService.unsubscribe(req.user._id);
  sendSuccess(res, {}, 'Push notification subscription removed');
});

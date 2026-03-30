import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import userService from '../services/userService.js';
import AppError from '../utils/AppError.js';

export const getProfile = catchAsync(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  sendSuccess(res, { user }, 'Profile retrieved');
});

export const updateProfile = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { user }, 'Profile updated');
});

export const uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided', 400);
  }
  const user = await userService.uploadAvatar(req.user._id, req.file.buffer);
  sendSuccess(res, { user }, 'Avatar updated');
});

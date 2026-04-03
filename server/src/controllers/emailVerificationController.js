import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import emailVerificationService from '../services/emailVerificationService.js';

export const sendVerification = catchAsync(async (req, res) => {
  const result = await emailVerificationService.sendVerification(req.user._id);
  sendSuccess(res, null, result.message);
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { code } = req.body;
  const result = await emailVerificationService.verifyEmail(req.user._id, code);
  sendSuccess(res, null, result.message);
});

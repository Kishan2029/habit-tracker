import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import authService from '../services/authService.js';

export const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  sendSuccess(res, result, 'User registered successfully', 201);
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  sendSuccess(res, result, 'Login successful');
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  const data = process.env.NODE_ENV !== 'production' ? { resetToken: result.resetToken } : {};
  sendSuccess(res, data, 'If an account exists with that email, a password reset link has been sent.');
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  sendSuccess(res, {}, 'Password has been reset successfully. You can now log in with your new password.');
});

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, { currentPassword, newPassword });
  sendSuccess(res, {}, 'Password changed successfully');
});

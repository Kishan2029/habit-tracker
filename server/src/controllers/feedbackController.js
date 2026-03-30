import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import Feedback from '../models/Feedback.js';
import emailService from '../services/emailService.js';

export const submitFeedback = catchAsync(async (req, res) => {
  const { mood, message, page } = req.body;

  const feedback = await Feedback.create({
    userId: req.user._id,
    mood,
    message,
    page,
  });

  // Send admin notification email (fire-and-forget)
  emailService
    .sendFeedbackNotification(req.user.name, req.user.email, mood, message, page)
    .catch((err) => console.error('Failed to send feedback notification email:', err));

  sendSuccess(res, { id: feedback._id }, 'Thank you for your feedback!', 201);
});

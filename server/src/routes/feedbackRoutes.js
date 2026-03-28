import { Router } from 'express';
import { body } from 'express-validator';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import rateLimiter from '../middleware/rateLimiter.js';
import { submitFeedback } from '../controllers/feedbackController.js';
import { MOODS } from '../models/Feedback.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 submissions per hour
  [
    body('mood').isIn(MOODS).withMessage(`Mood must be one of: ${MOODS.join(', ')}`),
    body('message')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Message must be under 2000 characters'),
    body('page')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .matches(/^\//)
      .withMessage('Page must be a valid path'),
  ],
  validate,
  submitFeedback
);

export default router;

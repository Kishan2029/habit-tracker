import { Router } from 'express';
import { body } from 'express-validator';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import rateLimiter from '../middleware/rateLimiter.js';
import { submitFeedback } from '../controllers/feedbackController.js';
import { MOODS } from '../models/Feedback.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: User feedback endpoints
 */

/**
 * @swagger
 * /feedback:
 *   post:
 *     summary: Submit user feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mood]
 *             properties:
 *               mood:
 *                 type: string
 *                 enum: [loved, happy, neutral, confused, sad]
 *                 example: happy
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 example: Great app, love the streak tracking!
 *               page:
 *                 type: string
 *                 maxLength: 200
 *                 example: /dashboard
 *                 description: Page path where feedback was submitted (must start with /)
 *     responses:
 *       201:
 *         description: Feedback submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Thank you for your feedback!
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many submissions (rate limited to 5 per hour)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

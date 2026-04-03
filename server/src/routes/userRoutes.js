import { Router } from 'express';
import { body } from 'express-validator';
import authenticate from '../middleware/authenticate.js';
import { getProfile, updateProfile, uploadAvatar } from '../controllers/userController.js';
import { sendVerification, verifyEmail } from '../controllers/emailVerificationController.js';
import { changePassword } from '../controllers/authController.js';
import { changePasswordRules } from '../validators/authValidators.js';
import validate from '../middleware/validate.js';
import upload from '../middleware/upload.js';

const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('settings.theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Theme must be light, dark, or system'),
  body('settings.timezone')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Timezone is required'),
  body('settings.reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Reminder time must be in HH:mm format'),
  body('settings.notifications.dailyReminders.push').optional().isBoolean(),
  body('settings.notifications.dailyReminders.email').optional().isBoolean(),
  body('settings.notifications.streakMilestones.push').optional().isBoolean(),
  body('settings.notifications.streakMilestones.email').optional().isBoolean(),
  body('settings.notifications.missedAlerts.push').optional().isBoolean(),
  body('settings.notifications.missedAlerts.email').optional().isBoolean(),
  body('settings.notifications.sharedActivity.push').optional().isBoolean(),
  body('settings.notifications.sharedActivity.email').optional().isBoolean(),
  body('settings.notifications.goalCompletion.push').optional().isBoolean(),
  body('settings.notifications.goalCompletion.email').optional().isBoolean(),
  body('settings.notifications.weeklySummary.push').optional().isBoolean(),
  body('settings.notifications.weeklySummary.email').optional().isBoolean(),
];

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
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
 *                   example: Profile retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Jane Doe
 *               settings:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: string
 *                     enum: [light, dark, system]
 *                   timezone:
 *                     type: string
 *                     example: America/New_York
 *     responses:
 *       200:
 *         description: Profile updated
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
 *                   example: Profile updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/profile', updateProfileRules, validate, updateProfile);
/**
 * @swagger
 * /users/profile/avatar:
 *   put:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, etc.)
 *     responses:
 *       200:
 *         description: Avatar uploaded
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
 *                   example: Avatar uploaded
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/profile/avatar', upload.single('avatar'), uploadAvatar);

/**
 * @swagger
 * /users/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                   example: Password changed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: New JWT token (client should update stored token)
 *       400:
 *         description: Validation error or incorrect current password
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
 */
router.put('/change-password', changePasswordRules, validate, changePassword);

const verifyEmailRules = [
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Verification code must be a 6-digit number'),
];

router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmailRules, validate, verifyEmail);

export default router;

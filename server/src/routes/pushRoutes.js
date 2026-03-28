import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import catchAsync from '../utils/catchAsync.js';
import { subscribe, unsubscribe } from '../controllers/pushController.js';
import pushService from '../services/pushService.js';
import env from '../config/env.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Push
 *   description: Push notification endpoints
 */

/**
 * @swagger
 * /push/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscription]
 *             properties:
 *               subscription:
 *                 $ref: '#/components/schemas/PushSubscription'
 *     responses:
 *       201:
 *         description: Push notification subscription saved
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
 *                   example: Push notification subscription saved
 *       400:
 *         description: Invalid subscription data
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
router.post('/subscribe', subscribe);

/**
 * @swagger
 * /push/unsubscribe:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Push notification subscription removed
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
 *                   example: Push notification subscription removed
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/unsubscribe', unsubscribe);

/**
 * @swagger
 * /push/test:
 *   post:
 *     summary: Send a test push notification (non-production only)
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent
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
 *                   example: Test notification sent
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Dev-only: trigger a test push notification to the logged-in user
if (env.nodeEnv !== 'production') {
  /**
   * @swagger
   * /push/test:
   *   post:
   *     summary: Send a test push notification (non-production only)
   *     tags: [Push]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Test notification sent
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
   *                   example: Test notification sent
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/test', catchAsync(async (req, res) => {
    await pushService.sendNotification(req.user._id, {
      title: '🔔 Habit Tracker',
      body: "Don't forget to log your habits today!",
      url: '/',
      tag: 'test',
    });
    res.json({ success: true, message: 'Test notification sent' });
  }));
}

export default router;

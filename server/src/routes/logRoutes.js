import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import {
  createLogRules,
  dailyQueryRules,
  monthlyQueryRules,
  yearlyQueryRules,
  rangeQueryRules,
} from '../validators/logValidators.js';
import {
  createOrUpdateLog,
  getDailyLogs,
  getMonthlyLogs,
  getYearlyLogs,
  getRangeLogs,
  getMembersProgress,
  getLeaderboard,
} from '../controllers/logController.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: Habit log tracking
 */

/**
 * @swagger
 * /logs:
 *   post:
 *     summary: Create or update a habit log entry
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [habitId, date, value]
 *             properties:
 *               habitId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-15"
 *                 description: "Format: YYYY-MM-DD. Cannot be a future date or more than 7 days in the past."
 *               value:
 *                 oneOf:
 *                   - type: boolean
 *                   - type: number
 *                 example: true
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 example: Felt great today!
 *     responses:
 *       201:
 *         description: Log created
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
 *                   example: Log created
 *                 data:
 *                   type: object
 *                   properties:
 *                     log:
 *                       $ref: '#/components/schemas/HabitLog'
 *       200:
 *         description: Log updated (existing log for that date)
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
 *                   example: Log updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     log:
 *                       $ref: '#/components/schemas/HabitLog'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createLogRules, validate, createOrUpdateLog);

/**
 * @swagger
 * /logs/daily:
 *   get:
 *     summary: Get daily logs for a specific date
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-15"
 *         description: "Date in YYYY-MM-DD format"
 *     responses:
 *       200:
 *         description: Daily logs retrieved
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
 *                   example: Daily logs retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       example: "2025-01-15"
 *                     habits:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           habit:
 *                             $ref: '#/components/schemas/Habit'
 *                           log:
 *                             nullable: true
 *                             allOf:
 *                               - $ref: '#/components/schemas/HabitLog'
 *                           isCompleted:
 *                             type: boolean
 *                     total:
 *                       type: number
 *                       description: Total habits scheduled for the day
 *                     completed:
 *                       type: number
 *                       description: Number of completed habits
 */
router.get('/daily', dailyQueryRules, validate, getDailyLogs);

/**
 * @swagger
 * /logs/monthly:
 *   get:
 *     summary: Get monthly logs
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month number (1-12)
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *         description: Year (2020-2100)
 *     responses:
 *       200:
 *         description: Monthly logs retrieved
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
 *                   example: Monthly logs retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     month:
 *                       type: number
 *                     year:
 *                       type: number
 *                     habits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Habit'
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/HabitLog'
 */
router.get('/monthly', monthlyQueryRules, validate, getMonthlyLogs);

/**
 * @swagger
 * /logs/yearly:
 *   get:
 *     summary: Get yearly logs with monthly aggregations
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *         description: Year (2020-2100)
 *     responses:
 *       200:
 *         description: Yearly logs retrieved
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
 *                   example: Yearly logs retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     year:
 *                       type: number
 *                     habits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Habit'
 *                     monthlyStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               month:
 *                                 type: number
 *                           totalLogs:
 *                             type: number
 *                           completedLogs:
 *                             type: number
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/HabitLog'
 */
router.get('/yearly', yearlyQueryRules, validate, getYearlyLogs);

/**
 * @swagger
 * /logs/range:
 *   get:
 *     summary: Get logs for a date range
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-31"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Range logs retrieved
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/HabitLog'
 */
router.get('/range', rangeQueryRules, validate, getRangeLogs);

/**
 * @swagger
 * /logs/shared/{habitId}/progress:
 *   get:
 *     summary: Get shared habit members' progress for a date
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shared habit ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-15"
 *         description: "Date in YYYY-MM-DD format"
 *     responses:
 *       200:
 *         description: Members progress retrieved
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
 *                   example: Members progress retrieved
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing date parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/shared/:habitId/progress', getMembersProgress);

/**
 * @swagger
 * /logs/shared/{habitId}/leaderboard:
 *   get:
 *     summary: Get leaderboard for a shared habit
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shared habit ID
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [week, month]
 *           default: week
 *         description: Time range for leaderboard
 *     responses:
 *       200:
 *         description: Leaderboard retrieved
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
 *                   example: Leaderboard retrieved
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid range parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/shared/:habitId/leaderboard', getLeaderboard);

export default router;

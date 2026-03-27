import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { createHabitRules, updateHabitRules, reorderHabitRules } from '../validators/habitValidators.js';
import {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  deleteHabit,
  reorderHabits,
} from '../controllers/habitController.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Habits
 *   description: Habit management
 */

/**
 * @swagger
 * /habits:
 *   get:
 *     summary: Get all habits for the current user
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include archived habits in results
 *     responses:
 *       200:
 *         description: Habits retrieved
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
 *                   example: Habits retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     habits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Habit'
 */
router.get('/', getHabits);

/**
 * @swagger
 * /habits/reorder:
 *   put:
 *     summary: Reorder habits by updating sort order
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, sortOrder]
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     sortOrder:
 *                       type: number
 *                       example: 0
 *     responses:
 *       200:
 *         description: Habits reordered
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
 *                   example: Habits reordered
 */
router.put('/reorder', reorderHabitRules, validate, reorderHabits);

/**
 * @swagger
 * /habits/{id}:
 *   get:
 *     summary: Get a specific habit by ID
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     habit:
 *                       $ref: '#/components/schemas/Habit'
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getHabit);

/**
 * @swagger
 * /habits:
 *   post:
 *     summary: Create a new habit
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Morning Run
 *               type:
 *                 type: string
 *                 enum: [boolean, count]
 *                 default: boolean
 *               unit:
 *                 type: string
 *                 maxLength: 50
 *                 example: km
 *               target:
 *                 type: number
 *                 minimum: 1
 *                 default: 1
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *                 default: '#6366f1'
 *               icon:
 *                 type: string
 *                 maxLength: 10
 *                 example: "\U0001F3AF"
 *               frequency:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 default: [0, 1, 2, 3, 4, 5, 6]
 *                 description: "Days of week (0=Sunday, 6=Saturday)"
 *               category:
 *                 type: string
 *                 enum: [health, fitness, learning, work, mindfulness, social, finance, other]
 *                 default: other
 *     responses:
 *       201:
 *         description: Habit created
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
 *                   example: Habit created
 *                 data:
 *                   type: object
 *                   properties:
 *                     habit:
 *                       $ref: '#/components/schemas/Habit'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createHabitRules, validate, createHabit);

/**
 * @swagger
 * /habits/{id}:
 *   put:
 *     summary: Update a habit
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
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
 *               type:
 *                 type: string
 *                 enum: [boolean, count]
 *               unit:
 *                 type: string
 *                 maxLength: 50
 *               target:
 *                 type: number
 *                 minimum: 1
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *               icon:
 *                 type: string
 *                 maxLength: 10
 *               frequency:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *               category:
 *                 type: string
 *                 enum: [health, fitness, learning, work, mindfulness, social, finance, other]
 *               sortOrder:
 *                 type: number
 *     responses:
 *       200:
 *         description: Habit updated
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
 *                   example: Habit updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     habit:
 *                       $ref: '#/components/schemas/Habit'
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', updateHabitRules, validate, updateHabit);

/**
 * @swagger
 * /habits/{id}/archive:
 *   put:
 *     summary: Archive a habit
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit archived
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
 *                   example: Habit archived
 *                 data:
 *                   type: object
 *                   properties:
 *                     habit:
 *                       $ref: '#/components/schemas/Habit'
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/archive', archiveHabit);

/**
 * @swagger
 * /habits/{id}/unarchive:
 *   put:
 *     summary: Unarchive a habit
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit unarchived
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
 *                   example: Habit unarchived
 *                 data:
 *                   type: object
 *                   properties:
 *                     habit:
 *                       $ref: '#/components/schemas/Habit'
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/unarchive', unarchiveHabit);

/**
 * @swagger
 * /habits/{id}:
 *   delete:
 *     summary: Delete a habit and its associated logs
 *     tags: [Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit deleted
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
 *                   example: Habit deleted
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteHabit);

export default router;

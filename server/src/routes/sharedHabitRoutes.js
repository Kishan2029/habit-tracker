import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import {
  shareHabit,
  joinByInviteCode,
  inviteMember,
  respondToInvite,
  removeMember,
  leaveHabit,
  updateMemberRole,
  transferOwnership,
  getSharedWithMe,
  getSharedByMe,
  getPendingInvites,
  getSharingInfo,
  regenerateInviteCode,
  unshareHabit,
  getInvitePreview,
} from '../controllers/sharedHabitController.js';
import {
  shareHabitRules,
  joinByCodeRules,
  inviteMemberRules,
  respondToInviteRules,
  updateRoleRules,
  transferOwnershipRules,
  habitIdParamRules,
  removeMemberRules,
} from '../validators/sharedHabitValidators.js';

const router = Router();

// Public route — no auth needed (for invite link previews before login)
router.get('/preview/:inviteCode', getInvitePreview);

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Shared Habits
 *   description: Shared habit management and collaboration
 */

/**
 * @swagger
 * /shared/share:
 *   post:
 *     summary: Share a habit (create sharing and generate invite code)
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [habitId]
 *             properties:
 *               habitId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       201:
 *         description: Habit shared
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
 *                   example: Habit shared
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *                     requesterRole:
 *                       type: string
 *                       example: owner
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/share', shareHabitRules, validate, shareHabit);

/**
 * @swagger
 * /shared/join:
 *   post:
 *     summary: Join a shared habit via invite code
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteCode]
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 example: abc123
 *     responses:
 *       200:
 *         description: Joined shared habit
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
 *                   example: Joined shared habit
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       400:
 *         description: Invalid invite code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/join', joinByCodeRules, validate, joinByInviteCode);

/**
 * @swagger
 * /shared/invite:
 *   post:
 *     summary: Invite a member by email to a shared habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [habitId, email]
 *             properties:
 *               habitId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               email:
 *                 type: string
 *                 format: email
 *                 example: friend@example.com
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *                 default: member
 *     responses:
 *       200:
 *         description: Invite sent
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
 *                   example: Invite sent via email
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *                     emailSent:
 *                       type: boolean
 *                     emailError:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/invite', inviteMemberRules, validate, inviteMember);

/**
 * @swagger
 * /shared/respond:
 *   post:
 *     summary: Accept or decline a shared habit invitation
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [habitId, accept]
 *             properties:
 *               habitId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               accept:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Invite response recorded
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
 *                   example: Invite accepted
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/respond', respondToInviteRules, validate, respondToInvite);

/**
 * @swagger
 * /shared/with-me:
 *   get:
 *     summary: Get habits shared with current user
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shared habits retrieved
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
 *                   example: Shared habits retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     sharedHabits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SharedHabit'
 */
router.get('/with-me', getSharedWithMe);

/**
 * @swagger
 * /shared/pending:
 *   get:
 *     summary: Get pending invitations for current user
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending invites retrieved
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
 *                   example: Pending invites retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     invites:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SharedHabit'
 */
router.get('/pending', getPendingInvites);

/**
 * @swagger
 * /shared/by-me:
 *   get:
 *     summary: Get habits shared by the current user (owner view)
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shared habits by user retrieved
 */
router.get('/by-me', getSharedByMe);

/**
 * @swagger
 * /shared/{habitId}:
 *   get:
 *     summary: Get sharing info for a habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Sharing info retrieved
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
 *                   example: Sharing info retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *                     requesterRole:
 *                       type: string
 *                       example: owner
 *       404:
 *         description: Sharing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:habitId', habitIdParamRules, validate, getSharingInfo);

/**
 * @swagger
 * /shared/{habitId}/regenerate-code:
 *   post:
 *     summary: Regenerate invite code for a shared habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Invite code regenerated
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
 *                   example: Invite code regenerated
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:habitId/regenerate-code', habitIdParamRules, validate, regenerateInviteCode);

/**
 * @swagger
 * /shared/{habitId}/members/{userId}/role:
 *   put:
 *     summary: Update a member's role in a shared habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *                 example: admin
 *     responses:
 *       200:
 *         description: Role updated
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
 *                   example: Role updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:habitId/members/:userId/role', updateRoleRules, validate, updateMemberRole);

/**
 * @swagger
 * /shared/{habitId}/transfer:
 *   put:
 *     summary: Transfer ownership of a shared habit to another member
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
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
 *             required: [newOwnerId]
 *             properties:
 *               newOwnerId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Ownership transferred
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
 *                   example: Ownership transferred
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       403:
 *         description: Not authorized (only owner can transfer)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:habitId/transfer', transferOwnershipRules, validate, transferOwnership);

/**
 * @swagger
 * /shared/{habitId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a shared habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member to remove
 *     responses:
 *       200:
 *         description: Member removed
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
 *                   example: Member removed
 *                 data:
 *                   type: object
 *                   properties:
 *                     shared:
 *                       $ref: '#/components/schemas/SharedHabit'
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:habitId/members/:userId', removeMemberRules, validate, removeMember);

/**
 * @swagger
 * /shared/{habitId}/leave:
 *   delete:
 *     summary: Leave a shared habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Left shared habit
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
 *                   example: Left shared habit
 *       400:
 *         description: Owner cannot leave (must transfer ownership first)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:habitId/leave', habitIdParamRules, validate, leaveHabit);

/**
 * @swagger
 * /shared/{habitId}:
 *   delete:
 *     summary: Deactivate sharing for a habit
 *     tags: [Shared Habits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit unshared
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
 *                   example: Habit unshared
 *       403:
 *         description: Not authorized (only owner can unshare)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:habitId', habitIdParamRules, validate, unshareHabit);

export default router;

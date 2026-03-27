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
  getPendingInvites,
  getSharingInfo,
  regenerateInviteCode,
  unshareHabit,
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

router.use(authenticate);

// Share a habit (create sharing + generate invite code)
router.post('/share', shareHabitRules, validate, shareHabit);

// Join via invite code
router.post('/join', joinByCodeRules, validate, joinByInviteCode);

// Invite a member by email
router.post('/invite', inviteMemberRules, validate, inviteMember);

// Respond to an invite (accept/decline)
router.post('/respond', respondToInviteRules, validate, respondToInvite);

// Get habits shared with current user
router.get('/with-me', getSharedWithMe);

// Get pending invites for current user
router.get('/pending', getPendingInvites);

// Get sharing info for a habit
router.get('/:habitId', habitIdParamRules, validate, getSharingInfo);

// Regenerate invite code
router.post('/:habitId/regenerate-code', habitIdParamRules, validate, regenerateInviteCode);

// Update a member's role
router.put('/:habitId/members/:userId/role', updateRoleRules, validate, updateMemberRole);

// Transfer ownership
router.put('/:habitId/transfer', transferOwnershipRules, validate, transferOwnership);

// Remove a member
router.delete('/:habitId/members/:userId', removeMemberRules, validate, removeMember);

// Leave a shared habit
router.delete('/:habitId/leave', habitIdParamRules, validate, leaveHabit);

// Unshare a habit (deactivate sharing)
router.delete('/:habitId', habitIdParamRules, validate, unshareHabit);

export default router;

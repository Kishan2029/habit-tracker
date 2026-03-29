import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import sharedHabitService from '../services/sharedHabitService.js';

export const shareHabit = catchAsync(async (req, res) => {
  let shared = await sharedHabitService.shareHabit(req.user._id, req.body.habitId);
  // Return populated data so the frontend has full user details
  shared = await sharedHabitService._populateShared(shared);
  sendSuccess(res, { shared, requesterRole: 'owner' }, 'Habit shared', 201);
});

export const joinByInviteCode = catchAsync(async (req, res) => {
  const shared = await sharedHabitService.joinByInviteCode(req.user._id, req.body.inviteCode);
  sendSuccess(res, { shared }, 'Joined shared habit');
});

export const inviteMember = catchAsync(async (req, res) => {
  const { habitId, email, role } = req.body;
  const { shared, emailSent, emailError } = await sharedHabitService.inviteMember(req.user._id, habitId, email, role);
  const message = emailSent
    ? 'Invite sent via email'
    : 'Member added to invite list (email notification could not be sent)';
  sendSuccess(res, { shared, emailSent, emailError }, message);
});

export const respondToInvite = catchAsync(async (req, res) => {
  const { habitId, accept } = req.body;
  const shared = await sharedHabitService.respondToInvite(req.user._id, habitId, accept);
  const message = accept ? 'Invite accepted' : 'Invite declined';
  sendSuccess(res, { shared }, message);
});

export const removeMember = catchAsync(async (req, res) => {
  const shared = await sharedHabitService.removeMember(
    req.user._id,
    req.params.habitId,
    req.params.userId
  );
  sendSuccess(res, { shared }, 'Member removed');
});

export const leaveHabit = catchAsync(async (req, res) => {
  const result = await sharedHabitService.leaveSharedHabit(req.user._id, req.params.habitId);
  sendSuccess(res, result, 'Left shared habit');
});

export const updateMemberRole = catchAsync(async (req, res) => {
  const shared = await sharedHabitService.updateMemberRole(
    req.user._id,
    req.params.habitId,
    req.params.userId,
    req.body.role
  );
  sendSuccess(res, { shared }, 'Role updated');
});

export const transferOwnership = catchAsync(async (req, res) => {
  const shared = await sharedHabitService.transferOwnership(
    req.user._id,
    req.params.habitId,
    req.body.newOwnerId
  );
  sendSuccess(res, { shared }, 'Ownership transferred');
});

export const getSharedWithMe = catchAsync(async (req, res) => {
  const sharedHabits = await sharedHabitService.getSharedHabitsForUser(req.user._id);
  sendSuccess(res, { sharedHabits }, 'Shared habits retrieved');
});

export const getPendingInvites = catchAsync(async (req, res) => {
  const invites = await sharedHabitService.getPendingInvites(req.user._id);
  sendSuccess(res, { invites }, 'Pending invites retrieved');
});

export const getSharingInfo = catchAsync(async (req, res) => {
  const result = await sharedHabitService.getSharingInfo(req.user._id, req.params.habitId);
  sendSuccess(res, result, 'Sharing info retrieved');
});

export const regenerateInviteCode = catchAsync(async (req, res) => {
  const shared = await sharedHabitService.regenerateInviteCode(req.user._id, req.params.habitId);
  sendSuccess(res, { shared }, 'Invite code regenerated');
});

export const unshareHabit = catchAsync(async (req, res) => {
  const result = await sharedHabitService.unshareHabit(req.user._id, req.params.habitId);
  sendSuccess(res, result, 'Habit unshared');
});

export const getSharedByMe = catchAsync(async (req, res) => {
  const sharedHabits = await sharedHabitService.getHabitsSharedByUser(req.user._id);
  sendSuccess(res, { sharedHabits }, 'Shared by me retrieved');
});

export const getInvitePreview = catchAsync(async (req, res) => {
  const preview = await sharedHabitService.getInvitePreview(req.params.inviteCode);
  sendSuccess(res, { preview }, 'Invite preview retrieved');
});

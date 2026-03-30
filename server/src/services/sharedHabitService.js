import crypto from 'crypto';
import mongoose from 'mongoose';
import SharedHabit from '../models/SharedHabit.js';
import Habit from '../models/Habit.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import emailService from './emailService.js';
import cache from './cacheService.js';

// Permission matrix actions
const PERMISSIONS = {
  editHabit: ['owner', 'admin'],
  deleteHabit: ['owner'],
  invite: ['owner', 'admin'],
  removeMember: ['owner', 'admin'],
  changeRole: ['owner'],
  logCompletion: ['owner', 'admin', 'member'],
  viewProgress: ['owner', 'admin', 'member', 'viewer'],
  leave: ['admin', 'member', 'viewer'],
  transferOwnership: ['owner'],
};

class SharedHabitService {
  // ─── Helper: extract ObjectId string safely (works for populated & raw) ─

  _toId(ref) {
    if (!ref) return null;
    if (ref._id) return ref._id.toString();
    return ref.toString();
  }

  // ─── Permission Helper ──────────────────────────────────────────────

  _getRole(sharedHabit, userId) {
    const uid = userId.toString();
    if (this._toId(sharedHabit.ownerId) === uid) return 'owner';
    const member = sharedHabit.sharedWith.find(
      (m) => this._toId(m.userId) === uid && m.status === 'accepted'
    );
    return member ? member.role : null;
  }

  _checkPermission(sharedHabit, userId, action) {
    const role = this._getRole(sharedHabit, userId);
    if (!role) return false;
    return PERMISSIONS[action]?.includes(role) ?? false;
  }

  _generateInviteCode() {
    return crypto.randomBytes(16).toString('hex');
  }

  // ─── Share a Habit (Owner creates sharing) ──────────────────────────

  async shareHabit(ownerId, habitId) {
    const habit = await Habit.findById(habitId);
    if (!habit) throw new AppError('Habit not found', 404);
    if (habit.userId.toString() !== ownerId.toString()) {
      throw new AppError('Only the habit owner can share it', 403);
    }
    if (habit.isArchived) {
      throw new AppError('Archived habits cannot be shared', 400);
    }

    // Check if already shared
    let shared = await SharedHabit.findOne({ habitId });
    if (shared && shared.isActive) {
      return shared;
    }

    if (shared && !shared.isActive) {
      // Reactivate
      shared.isActive = true;
      shared.ownerId = ownerId;
      shared.inviteCode = this._generateInviteCode();
      shared.sharedWith = [];
      await shared.save();
      return shared;
    }

    try {
      shared = await SharedHabit.create({
        habitId,
        ownerId,
        inviteCode: this._generateInviteCode(),
        sharedWith: [],
      });
    } catch (err) {
      // Handle race condition: another request created it first
      if (err.code === 11000) {
        shared = await SharedHabit.findOne({ habitId, isActive: true });
        if (shared) return shared;
      }
      throw err;
    }

    return shared;
  }

  // ─── Join by Invite Code ────────────────────────────────────────────

  async joinByInviteCode(userId, inviteCode) {
    const shared = await SharedHabit.findOne({ inviteCode, isActive: true });
    if (!shared) throw new AppError('Invalid or expired invite link', 404);

    if (this._toId(shared.ownerId) === userId.toString()) {
      throw new AppError('You cannot join your own shared habit', 400);
    }

    const alreadyJoined = shared.sharedWith.find(
      (m) => this._toId(m.userId) === userId.toString()
    );
    if (alreadyJoined) {
      if (alreadyJoined.status === 'accepted') {
        throw new AppError('You have already joined this habit', 400);
      }
      if (alreadyJoined.status === 'pending') {
        // Auto-accept if they have the invite code
        alreadyJoined.status = 'accepted';
        alreadyJoined.joinedAt = new Date();
        await shared.save();
        cache.delByPrefix(`habits:${userId}`);
        return shared;
      }
      if (alreadyJoined.status === 'declined') {
        // Allow re-joining without rewriting the previously assigned role.
        alreadyJoined.status = 'accepted';
        alreadyJoined.joinedAt = new Date();
        await shared.save();
        cache.delByPrefix(`habits:${userId}`);
        return shared;
      }
    }

    shared.sharedWith.push({
      userId,
      role: 'member',
      status: 'accepted',
      joinedAt: new Date(),
    });
    await shared.save();

    cache.delByPrefix(`habits:${userId}`);
    return shared;
  }

  // ─── Invite Member by Email ─────────────────────────────────────────

  async inviteMember(requesterId, habitId, email, role = 'member') {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('This habit is not being shared', 404);

    if (!this._checkPermission(shared, requesterId, 'invite')) {
      throw new AppError('You do not have permission to invite members', 403);
    }

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) throw new AppError('No user found with that email', 404);

    const targetId = targetUser._id.toString();
    if (this._toId(shared.ownerId) === targetId) {
      throw new AppError('Cannot invite the habit owner', 400);
    }

    const existing = shared.sharedWith.find(
      (m) => this._toId(m.userId) === targetId
    );
    if (existing && existing.status === 'accepted') {
      throw new AppError('User is already a member', 400);
    }
    if (existing && existing.status === 'pending') {
      throw new AppError('User already has a pending invite', 400);
    }

    if (existing && existing.status === 'declined') {
      // Re-invite
      existing.status = 'pending';
      existing.role = role;
      existing.invitedBy = requesterId;
    } else {
      shared.sharedWith.push({
        userId: targetUser._id,
        role,
        status: 'pending',
        invitedBy: requesterId,
      });
    }

    await shared.save();

    // Send invite email (non-blocking — don't fail the invite if email fails)
    let emailSent = false;
    let emailError = null;

    if (!emailService.isConfigured) {
      emailError = 'Email service not configured (SMTP settings missing)';
    } else {
      try {
        const inviter = await User.findById(requesterId, 'name');
        const habit = await Habit.findById(habitId, 'name');
        await emailService.sendHabitInviteEmail(
          targetUser.email,
          targetUser.name,
          inviter?.name || 'Someone',
          habit?.name || 'a habit',
          shared.inviteCode
        );
        emailSent = true;
      } catch (emailErr) {
        console.error('Failed to send invite email:', emailErr.message, emailErr.stack);
        emailError = emailErr.message;
      }
    }

    return { shared, emailSent, emailError };
  }

  // ─── Respond to Invite ──────────────────────────────────────────────

  async respondToInvite(userId, habitId, accept) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    const member = shared.sharedWith.find(
      (m) => this._toId(m.userId) === userId.toString() && m.status === 'pending'
    );
    if (!member) throw new AppError('No pending invite found', 404);

    member.status = accept ? 'accepted' : 'declined';
    if (accept) member.joinedAt = new Date();
    await shared.save();

    if (accept) cache.delByPrefix(`habits:${userId}`);
    return shared;
  }

  // ─── Remove Member ──────────────────────────────────────────────────

  async removeMember(requesterId, habitId, targetUserId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (!this._checkPermission(shared, requesterId, 'removeMember')) {
      throw new AppError('You do not have permission to remove members', 403);
    }

    const requesterRole = this._getRole(shared, requesterId);
    const targetMember = shared.sharedWith.find(
      (m) => this._toId(m.userId) === targetUserId.toString()
    );
    if (!targetMember) throw new AppError('Member not found', 404);

    // Admin cannot remove other admins
    if (requesterRole === 'admin' && targetMember.role === 'admin') {
      throw new AppError('Admins cannot remove other admins', 403);
    }

    shared.sharedWith = shared.sharedWith.filter(
      (m) => this._toId(m.userId) !== targetUserId.toString()
    );
    await shared.save();

    cache.delByPrefix(`habits:${targetUserId}`);
    return shared;
  }

  // ─── Leave Shared Habit ─────────────────────────────────────────────

  async leaveSharedHabit(userId, habitId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (this._toId(shared.ownerId) === userId.toString()) {
      throw new AppError('Owner cannot leave. Transfer ownership first or unshare the habit.', 400);
    }

    const memberIndex = shared.sharedWith.findIndex(
      (m) => this._toId(m.userId) === userId.toString()
    );
    if (memberIndex === -1) throw new AppError('You are not a member of this habit', 404);

    shared.sharedWith.splice(memberIndex, 1);
    await shared.save();

    cache.delByPrefix(`habits:${userId}`);
    return { message: 'Left shared habit' };
  }

  // ─── Update Member Role ─────────────────────────────────────────────

  async updateMemberRole(ownerId, habitId, targetUserId, newRole) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (!this._checkPermission(shared, ownerId, 'changeRole')) {
      throw new AppError('Only the owner can change roles', 403);
    }

    const member = shared.sharedWith.find(
      (m) => this._toId(m.userId) === targetUserId.toString() && m.status === 'accepted'
    );
    if (!member) throw new AppError('Accepted member not found', 404);

    member.role = newRole;
    await shared.save();

    cache.delByPrefix(`habits:${targetUserId}`);
    return shared;
  }

  // ─── Transfer Ownership ─────────────────────────────────────────────

  async transferOwnership(ownerId, habitId, newOwnerId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (this._toId(shared.ownerId) !== ownerId.toString()) {
      throw new AppError('Only the owner can transfer ownership', 403);
    }

    const newOwnerMember = shared.sharedWith.find(
      (m) => this._toId(m.userId) === newOwnerId.toString() && m.status === 'accepted'
    );
    if (!newOwnerMember) {
      throw new AppError('New owner must be an accepted member', 400);
    }

    // Update the habit's userId to new owner
    await Habit.findByIdAndUpdate(habitId, { userId: newOwnerId });

    // Invalidate habit cache for both old and new owner
    cache.delByPrefix(`habits:${ownerId}`);
    cache.delByPrefix(`habits:${newOwnerId}`);

    // Remove new owner from sharedWith, add old owner as admin
    shared.sharedWith = shared.sharedWith.filter(
      (m) => this._toId(m.userId) !== newOwnerId.toString()
    );
    shared.sharedWith.push({
      userId: ownerId,
      role: 'admin',
      status: 'accepted',
      joinedAt: new Date(),
    });
    shared.ownerId = newOwnerId;
    await shared.save();

    return shared;
  }

  // ─── Get Shared Habits For User ─────────────────────────────────────

  async getSharedHabitsForUser(userId) {
    const sharedHabits = await SharedHabit.find({
      sharedWith: { $elemMatch: { userId, status: 'accepted' } },
      isActive: true,
    }).populate({
      path: 'habitId',
      select: 'name icon color type unit target frequency category isArchived',
      match: { isArchived: false },
    }).populate('ownerId', 'name email avatar');

    // Filter out entries where the habit was archived (populated as null)
    return sharedHabits.filter((sh) => sh.habitId != null);
  }

  // ─── Get Pending Invites ────────────────────────────────────────────

  async getPendingInvites(userId) {
    const sharedHabits = await SharedHabit.find({
      'sharedWith': {
        $elemMatch: { userId, status: 'pending' },
      },
      isActive: true,
    }).populate('habitId', 'name icon color type unit target frequency category')
      .populate('ownerId', 'name email avatar');

    return sharedHabits.map((sh) => {
      const invite = sh.sharedWith.find(
        (m) => this._toId(m.userId) === userId.toString() && m.status === 'pending'
      );
      return {
        habitId: sh.habitId,
        ownerId: sh.ownerId,
        role: invite.role,
        invitedAt: invite._id?.getTimestamp?.() || invite.joinedAt,
      };
    });
  }

  // ─── Populate a SharedHabit document ────────────────────────────────

  async _populateShared(shared) {
    return SharedHabit.findById(shared._id)
      .populate('sharedWith.userId', 'name email avatar')
      .populate('sharedWith.invitedBy', 'name')
      .populate('ownerId', 'name email avatar');
  }

  // ─── Get Sharing Info ───────────────────────────────────────────────

  async getSharingInfo(requesterId, habitId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true })
      .populate('sharedWith.userId', 'name email avatar')
      .populate('sharedWith.invitedBy', 'name')
      .populate('ownerId', 'name email avatar');

    if (!shared) throw new AppError('This habit is not being shared', 404);

    // Any member or owner can view
    const role = this._getRole(shared, requesterId);
    if (!role) {
      throw new AppError('You do not have access to this shared habit', 403);
    }

    const sharedData = shared.toObject();

    if (!this._checkPermission(shared, requesterId, 'invite')) {
      delete sharedData.inviteCode;
      sharedData.sharedWith = sharedData.sharedWith
        .filter((member) => member.status === 'accepted')
        .map(({ invitedBy, ...member }) => member);
    }

    return { shared: sharedData, requesterRole: role };
  }

  // ─── Regenerate Invite Code ─────────────────────────────────────────

  async regenerateInviteCode(requesterId, habitId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (!this._checkPermission(shared, requesterId, 'invite')) {
      throw new AppError('You do not have permission to manage invite codes', 403);
    }

    shared.inviteCode = this._generateInviteCode();
    await shared.save();

    return shared;
  }

  // ─── Unshare Habit ──────────────────────────────────────────────────

  async unshareHabit(ownerId, habitId) {
    const shared = await SharedHabit.findOne({ habitId, isActive: true });
    if (!shared) throw new AppError('Shared habit not found', 404);

    if (this._toId(shared.ownerId) !== ownerId.toString()) {
      throw new AppError('Only the owner can unshare a habit', 403);
    }

    // Invalidate caches for all members before clearing
    for (const member of shared.sharedWith) {
      const memberId = this._toId(member.userId);
      if (memberId) cache.delByPrefix(`habits:${memberId}`);
    }

    shared.isActive = false;
    shared.inviteCode = undefined;
    shared.sharedWith = [];
    await shared.save();

    return { message: 'Habit unshared' };
  }

  // ─── Get User's Role for a Habit (used by logService) ───────────────

  async getUserRoleForHabit(userId, habitId) {
    const hid = new mongoose.Types.ObjectId(String(habitId));
    const shared = await SharedHabit.findOne({ habitId: hid, isActive: true });

    if (!shared) {
      return null;
    }

    const uid = userId.toString();
    if (shared.ownerId.toString() === uid) return 'owner';

    const member = shared.sharedWith.find(
      (m) => m.userId.toString() === uid && m.status === 'accepted'
    );
    return member ? member.role : null;
  }

  // ─── Get Habits Shared BY User (owner view) ────────────────────────

  async getHabitsSharedByUser(ownerId) {
    const sharedHabits = await SharedHabit.find({
      ownerId,
      isActive: true,
    })
      .populate({
        path: 'habitId',
        select: 'name icon color type unit target frequency category isArchived',
        match: { isArchived: false },
      })
      .populate('sharedWith.userId', 'name email avatar');

    // Filter out entries where the habit was archived (populated as null)
    return sharedHabits.filter((sh) => sh.habitId != null);
  }

  // ─── Get Invite Preview (public — no auth needed) ─────────────────

  async getInvitePreview(inviteCode) {
    const shared = await SharedHabit.findOne({ inviteCode, isActive: true })
      .populate('habitId', 'name icon color type')
      .populate('ownerId', 'name');

    if (!shared || !shared.habitId) {
      throw new AppError('Invalid or expired invite link', 404);
    }

    const acceptedCount = shared.sharedWith.filter((m) => m.status === 'accepted').length;

    return {
      habitName: shared.habitId.name,
      habitIcon: shared.habitId.icon,
      habitColor: shared.habitId.color,
      habitType: shared.habitId.type,
      ownerName: shared.ownerId?.name || 'Unknown',
      memberCount: acceptedCount + 1, // +1 for owner
    };
  }

  // ─── Get habits shared with a user that are scheduled for a given day ─

  async getSharedHabitIdsForUser(userId) {
    const sharedHabits = await SharedHabit.find({
      'sharedWith': {
        $elemMatch: { userId, status: 'accepted' },
      },
      isActive: true,
    });

    return sharedHabits.map((sh) => {
      const member = sh.sharedWith.find(
        (m) => this._toId(m.userId) === userId.toString() && m.status === 'accepted'
      );
      return {
        habitId: sh.habitId,
        ownerId: sh.ownerId,
        role: member.role,
      };
    });
  }
}

export default new SharedHabitService();

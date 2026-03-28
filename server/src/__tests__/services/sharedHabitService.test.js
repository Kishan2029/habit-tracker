import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/SharedHabit.js', () => ({
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  default: {
    sendHabitInviteEmail: jest.fn(),
    isConfigured: true,
  },
}));

jest.unstable_mockModule('../../services/cacheService.js', () => ({
  default: {
    delByPrefix: jest.fn(),
  },
}));

const { default: SharedHabit } = await import('../../models/SharedHabit.js');
const { default: Habit } = await import('../../models/Habit.js');
const { default: User } = await import('../../models/User.js');
const { default: emailService } = await import('../../services/emailService.js');
const { default: cache } = await import('../../services/cacheService.js');
const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');

// Helper to create a mock shared habit document
const createMockShared = (overrides = {}) => ({
  _id: 'sh1',
  habitId: 'h1',
  ownerId: { _id: 'owner1', toString: () => 'owner1' },
  inviteCode: 'abc123',
  isActive: true,
  sharedWith: [],
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({
    _id: 'sh1',
    habitId: 'h1',
    ownerId: 'owner1',
    inviteCode: 'abc123',
    sharedWith: [],
  }),
  ...overrides,
});

describe('SharedHabitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Helper methods ─────────────────────────────────────────────

  describe('_toId', () => {
    it('should return null for falsy input', () => {
      expect(sharedHabitService._toId(null)).toBeNull();
      expect(sharedHabitService._toId(undefined)).toBeNull();
    });

    it('should extract _id if present', () => {
      expect(sharedHabitService._toId({ _id: { toString: () => 'abc' } })).toBe('abc');
    });

    it('should call toString on plain refs', () => {
      expect(sharedHabitService._toId({ toString: () => 'xyz' })).toBe('xyz');
    });
  });

  describe('_getRole', () => {
    it('should return owner for the owner', () => {
      const shared = createMockShared();
      expect(sharedHabitService._getRole(shared, 'owner1')).toBe('owner');
    });

    it('should return role for accepted member', () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'admin', status: 'accepted' },
        ],
      });
      expect(sharedHabitService._getRole(shared, 'u2')).toBe('admin');
    });

    it('should return null for pending member', () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'pending' },
        ],
      });
      expect(sharedHabitService._getRole(shared, 'u2')).toBeNull();
    });

    it('should return null for non-member', () => {
      const shared = createMockShared();
      expect(sharedHabitService._getRole(shared, 'stranger')).toBeNull();
    });
  });

  describe('_checkPermission', () => {
    it('should return true for allowed actions', () => {
      const shared = createMockShared();
      expect(sharedHabitService._checkPermission(shared, 'owner1', 'deleteHabit')).toBe(true);
      expect(sharedHabitService._checkPermission(shared, 'owner1', 'invite')).toBe(true);
    });

    it('should return false for disallowed actions', () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      expect(sharedHabitService._checkPermission(shared, 'u2', 'deleteHabit')).toBe(false);
      expect(sharedHabitService._checkPermission(shared, 'u2', 'invite')).toBe(false);
    });

    it('should return false for non-member', () => {
      const shared = createMockShared();
      expect(sharedHabitService._checkPermission(shared, 'stranger', 'viewProgress')).toBe(false);
    });
  });

  // ─── shareHabit ─────────────────────────────────────────────────

  describe('shareHabit', () => {
    it('should throw 404 if habit not found', async () => {
      Habit.findById.mockResolvedValue(null);

      await expect(sharedHabitService.shareHabit('owner1', 'h1')).rejects.toMatchObject({
        message: 'Habit not found',
        statusCode: 404,
      });
    });

    it('should throw 403 if user is not habit owner', async () => {
      Habit.findById.mockResolvedValue({ userId: { toString: () => 'otherUser' } });

      await expect(sharedHabitService.shareHabit('owner1', 'h1')).rejects.toMatchObject({
        message: 'Only the habit owner can share it',
        statusCode: 403,
      });
    });

    it('should throw 400 if habit is archived', async () => {
      Habit.findById.mockResolvedValue({
        userId: { toString: () => 'owner1' },
        isArchived: true,
      });

      await expect(sharedHabitService.shareHabit('owner1', 'h1')).rejects.toMatchObject({
        message: 'Archived habits cannot be shared',
        statusCode: 400,
      });
    });

    it('should return existing active shared habit', async () => {
      const habit = { userId: { toString: () => 'owner1' }, isArchived: false };
      Habit.findById.mockResolvedValue(habit);
      const existingShared = createMockShared({ isActive: true });
      SharedHabit.findOne.mockResolvedValue(existingShared);

      const result = await sharedHabitService.shareHabit('owner1', 'h1');
      expect(result).toEqual(existingShared);
    });

    it('should reactivate inactive shared habit', async () => {
      const habit = { userId: { toString: () => 'owner1' }, isArchived: false };
      Habit.findById.mockResolvedValue(habit);
      const inactiveShared = createMockShared({ isActive: false });
      SharedHabit.findOne.mockResolvedValue(inactiveShared);

      await sharedHabitService.shareHabit('owner1', 'h1');

      expect(inactiveShared.isActive).toBe(true);
      expect(inactiveShared.sharedWith).toEqual([]);
      expect(inactiveShared.save).toHaveBeenCalled();
    });

    it('should create new shared habit if none exists', async () => {
      const habit = { userId: { toString: () => 'owner1' }, isArchived: false };
      Habit.findById.mockResolvedValue(habit);
      SharedHabit.findOne.mockResolvedValue(null);
      const newShared = createMockShared();
      SharedHabit.create.mockResolvedValue(newShared);

      const result = await sharedHabitService.shareHabit('owner1', 'h1');
      expect(SharedHabit.create).toHaveBeenCalled();
      expect(result).toEqual(newShared);
    });

    it('should handle duplicate key race condition', async () => {
      const habit = { userId: { toString: () => 'owner1' }, isArchived: false };
      Habit.findById.mockResolvedValue(habit);
      SharedHabit.findOne.mockResolvedValueOnce(null);
      const duplicateError = new Error('duplicate');
      duplicateError.code = 11000;
      SharedHabit.create.mockRejectedValue(duplicateError);
      const existingShared = createMockShared();
      SharedHabit.findOne.mockResolvedValueOnce(existingShared);

      const result = await sharedHabitService.shareHabit('owner1', 'h1');
      expect(result).toEqual(existingShared);
    });
  });

  // ─── joinByInviteCode ───────────────────────────────────────────

  describe('joinByInviteCode', () => {
    it('should throw 404 for invalid invite code', async () => {
      SharedHabit.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.joinByInviteCode('u1', 'badcode')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 400 if owner tries to join own habit', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.joinByInviteCode('owner1', 'abc123')).rejects.toMatchObject({
        message: 'You cannot join your own shared habit',
        statusCode: 400,
      });
    });

    it('should throw 400 if already accepted', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.joinByInviteCode('u2', 'abc123')).rejects.toMatchObject({
        message: 'You have already joined this habit',
        statusCode: 400,
      });
    });

    it('should auto-accept pending invite', async () => {
      const pendingMember = { userId: { _id: 'u2', toString: () => 'u2' }, status: 'pending' };
      const shared = createMockShared({ sharedWith: [pendingMember] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.joinByInviteCode('u2', 'abc123');

      expect(pendingMember.status).toBe('accepted');
      expect(shared.save).toHaveBeenCalled();
    });

    it('should allow re-joining after decline', async () => {
      const declinedMember = { userId: { _id: 'u2', toString: () => 'u2' }, status: 'declined', role: 'viewer' };
      const shared = createMockShared({ sharedWith: [declinedMember] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.joinByInviteCode('u2', 'abc123');

      expect(declinedMember.status).toBe('accepted');
      expect(declinedMember.role).toBe('member');
      expect(shared.save).toHaveBeenCalled();
    });

    it('should add new member if not already in list', async () => {
      const shared = createMockShared({ sharedWith: [] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.joinByInviteCode('u2', 'abc123');

      expect(shared.sharedWith).toHaveLength(1);
      expect(shared.sharedWith[0]).toMatchObject({
        userId: 'u2',
        role: 'member',
        status: 'accepted',
      });
      expect(shared.save).toHaveBeenCalled();
    });
  });

  // ─── inviteMember ───────────────────────────────────────────────

  describe('inviteMember', () => {
    it('should throw 404 if habit not shared', async () => {
      SharedHabit.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.inviteMember('owner1', 'h1', 'bob@test.com')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if requester lacks invite permission', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.inviteMember('u2', 'h1', 'bob@test.com')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw 404 if target user not found', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.inviteMember('owner1', 'h1', 'nobody@test.com')).rejects.toMatchObject({
        message: 'No user found with that email',
        statusCode: 404,
      });
    });

    it('should throw 400 if inviting the owner', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'owner1' }, email: 'owner@test.com', name: 'Owner' });

      await expect(sharedHabitService.inviteMember('owner1', 'h1', 'owner@test.com')).rejects.toMatchObject({
        message: 'Cannot invite the habit owner',
        statusCode: 400,
      });
    });

    it('should throw 400 if user is already accepted member', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, status: 'accepted', role: 'member' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u2' }, email: 'bob@test.com', name: 'Bob' });

      await expect(sharedHabitService.inviteMember('owner1', 'h1', 'bob@test.com')).rejects.toMatchObject({
        message: 'User is already a member',
        statusCode: 400,
      });
    });

    it('should throw 400 if user has pending invite', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, status: 'pending', role: 'member' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u2' }, email: 'bob@test.com', name: 'Bob' });

      await expect(sharedHabitService.inviteMember('owner1', 'h1', 'bob@test.com')).rejects.toMatchObject({
        message: 'User already has a pending invite',
        statusCode: 400,
      });
    });

    it('should re-invite declined user', async () => {
      const declinedMember = { userId: { _id: 'u2', toString: () => 'u2' }, status: 'declined', role: 'viewer' };
      const shared = createMockShared({ sharedWith: [declinedMember] });
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u2' }, email: 'bob@test.com', name: 'Bob' });
      User.findById.mockResolvedValue({ name: 'Owner' });
      Habit.findById.mockResolvedValue({ name: 'Exercise' });
      emailService.sendHabitInviteEmail.mockResolvedValue();

      const result = await sharedHabitService.inviteMember('owner1', 'h1', 'bob@test.com', 'admin');

      expect(declinedMember.status).toBe('pending');
      expect(declinedMember.role).toBe('admin');
      expect(shared.save).toHaveBeenCalled();
      expect(result.emailSent).toBe(true);
    });

    it('should add new member and send email', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u3' }, email: 'charlie@test.com', name: 'Charlie' });
      User.findById.mockResolvedValue({ name: 'Owner' });
      Habit.findById.mockResolvedValue({ name: 'Exercise' });
      emailService.sendHabitInviteEmail.mockResolvedValue();

      const result = await sharedHabitService.inviteMember('owner1', 'h1', 'charlie@test.com');

      expect(shared.sharedWith).toHaveLength(1);
      expect(shared.save).toHaveBeenCalled();
      expect(result.emailSent).toBe(true);
      expect(result.emailError).toBeNull();
    });

    it('should handle email failure gracefully', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u3' }, email: 'c@test.com', name: 'C' });
      User.findById.mockResolvedValue({ name: 'Owner' });
      Habit.findById.mockResolvedValue({ name: 'Exercise' });
      emailService.sendHabitInviteEmail.mockRejectedValue(new Error('SMTP error'));

      const result = await sharedHabitService.inviteMember('owner1', 'h1', 'c@test.com');

      expect(result.emailSent).toBe(false);
      expect(result.emailError).toBe('SMTP error');
    });
  });

  // ─── respondToInvite ────────────────────────────────────────────

  describe('respondToInvite', () => {
    it('should throw 404 if shared habit not found', async () => {
      SharedHabit.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.respondToInvite('u1', 'h1', true)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 404 if no pending invite', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.respondToInvite('u2', 'h1', true)).rejects.toMatchObject({
        message: 'No pending invite found',
        statusCode: 404,
      });
    });

    it('should accept invite', async () => {
      const member = { userId: { _id: 'u2', toString: () => 'u2' }, status: 'pending' };
      const shared = createMockShared({ sharedWith: [member] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.respondToInvite('u2', 'h1', true);

      expect(member.status).toBe('accepted');
      expect(member.joinedAt).toBeDefined();
      expect(shared.save).toHaveBeenCalled();
    });

    it('should decline invite', async () => {
      const member = { userId: { _id: 'u2', toString: () => 'u2' }, status: 'pending' };
      const shared = createMockShared({ sharedWith: [member] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.respondToInvite('u2', 'h1', false);

      expect(member.status).toBe('declined');
      expect(shared.save).toHaveBeenCalled();
    });
  });

  // ─── removeMember ───────────────────────────────────────────────

  describe('removeMember', () => {
    it('should throw 403 if requester lacks permission', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
          { userId: { _id: 'u3', toString: () => 'u3' }, role: 'viewer', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.removeMember('u2', 'h1', 'u3')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw 404 if target member not found', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.removeMember('owner1', 'h1', 'nobody')).rejects.toMatchObject({
        message: 'Member not found',
        statusCode: 404,
      });
    });

    it('should throw 403 if admin tries to remove another admin', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'admin', status: 'accepted' },
          { userId: { _id: 'u3', toString: () => 'u3' }, role: 'admin', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.removeMember('u2', 'h1', 'u3')).rejects.toMatchObject({
        message: 'Admins cannot remove other admins',
        statusCode: 403,
      });
    });

    it('should remove member successfully', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.removeMember('owner1', 'h1', 'u2');

      expect(shared.sharedWith).toHaveLength(0);
      expect(shared.save).toHaveBeenCalled();
    });
  });

  // ─── leaveSharedHabit ───────────────────────────────────────────

  describe('leaveSharedHabit', () => {
    it('should throw 400 if owner tries to leave', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.leaveSharedHabit('owner1', 'h1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 if not a member', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.leaveSharedHabit('stranger', 'h1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should leave successfully', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.leaveSharedHabit('u2', 'h1');

      expect(shared.sharedWith).toHaveLength(0);
      expect(result.message).toBe('Left shared habit');
    });
  });

  // ─── updateMemberRole ──────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('should throw 403 if not owner', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'admin', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.updateMemberRole('u2', 'h1', 'u3', 'admin')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw 404 if accepted member not found', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'pending' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.updateMemberRole('owner1', 'h1', 'u2', 'admin')).rejects.toMatchObject({
        message: 'Accepted member not found',
        statusCode: 404,
      });
    });

    it('should update role successfully', async () => {
      const member = { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' };
      const shared = createMockShared({ sharedWith: [member] });
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.updateMemberRole('owner1', 'h1', 'u2', 'admin');

      expect(member.role).toBe('admin');
      expect(shared.save).toHaveBeenCalled();
    });
  });

  // ─── transferOwnership ──────────────────────────────────────────

  describe('transferOwnership', () => {
    it('should throw 403 if not owner', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'admin', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.transferOwnership('u2', 'h1', 'u3')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw 400 if new owner is not accepted member', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.transferOwnership('owner1', 'h1', 'u2')).rejects.toMatchObject({
        message: 'New owner must be an accepted member',
        statusCode: 400,
      });
    });

    it('should transfer ownership successfully', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'admin', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);
      Habit.findByIdAndUpdate.mockResolvedValue({});

      await sharedHabitService.transferOwnership('owner1', 'h1', 'u2');

      expect(Habit.findByIdAndUpdate).toHaveBeenCalledWith('h1', { userId: 'u2' });
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:owner1');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
      expect(shared.ownerId).toBe('u2');
      expect(shared.save).toHaveBeenCalled();
      // Old owner should be added as admin
      const oldOwnerEntry = shared.sharedWith.find(
        (m) => m.userId === 'owner1'
      );
      expect(oldOwnerEntry).toBeDefined();
      expect(oldOwnerEntry.role).toBe('admin');
    });
  });

  // ─── unshareHabit ──────────────────────────────────────────────

  describe('unshareHabit', () => {
    it('should throw 403 if not owner', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.unshareHabit('u2', 'h1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should deactivate shared habit', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.unshareHabit('owner1', 'h1');

      expect(shared.isActive).toBe(false);
      expect(shared.sharedWith).toEqual([]);
      expect(shared.inviteCode).toBeUndefined();
      expect(result.message).toBe('Habit unshared');
    });
  });

  // ─── regenerateInviteCode ───────────────────────────────────────

  describe('regenerateInviteCode', () => {
    it('should throw 403 if user lacks invite permission', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.regenerateInviteCode('u2', 'h1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should regenerate code for owner', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.regenerateInviteCode('owner1', 'h1');

      expect(shared.inviteCode).not.toBe('abc123'); // Changed
      expect(shared.save).toHaveBeenCalled();
    });
  });

  // ─── getSharingInfo ─────────────────────────────────────────────

  describe('getSharingInfo', () => {
    it('should throw 404 if not shared', async () => {
      SharedHabit.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(sharedHabitService.getSharingInfo('u1', 'h1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 403 if user has no role', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(shared),
          }),
        }),
      });

      await expect(sharedHabitService.getSharingInfo('stranger', 'h1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should return sharing info for owner with invite code', async () => {
      const shared = createMockShared();
      SharedHabit.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(shared),
          }),
        }),
      });

      const result = await sharedHabitService.getSharingInfo('owner1', 'h1');

      expect(result.requesterRole).toBe('owner');
      expect(result.shared.inviteCode).toBe('abc123');
    });

    it('should strip invite code for members without invite permission', async () => {
      const shared = createMockShared({
        sharedWith: [
          { userId: { _id: 'u2', toString: () => 'u2' }, role: 'member', status: 'accepted' },
        ],
      });
      shared.toObject.mockReturnValue({
        _id: 'sh1',
        habitId: 'h1',
        ownerId: 'owner1',
        inviteCode: 'abc123',
        sharedWith: [
          { userId: 'u2', role: 'member', status: 'accepted', invitedBy: 'owner1' },
        ],
      });
      SharedHabit.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(shared),
          }),
        }),
      });

      const result = await sharedHabitService.getSharingInfo('u2', 'h1');

      expect(result.requesterRole).toBe('member');
      expect(result.shared.inviteCode).toBeUndefined();
    });
  });

  // ─── getSharedHabitsForUser ─────────────────────────────────────

  describe('getSharedHabitsForUser', () => {
    it('should return filtered shared habits', async () => {
      const sharedHabits = [
        { habitId: { name: 'Exercise' } },
        { habitId: null }, // archived habit
      ];
      SharedHabit.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(sharedHabits),
        }),
      });

      const result = await sharedHabitService.getSharedHabitsForUser('u1');

      expect(result).toHaveLength(1);
      expect(result[0].habitId.name).toBe('Exercise');
    });
  });

  // ─── getPendingInvites ──────────────────────────────────────────

  describe('getPendingInvites', () => {
    it('should return pending invites with role', async () => {
      const sharedHabits = [{
        habitId: { name: 'Exercise' },
        ownerId: { name: 'Owner' },
        sharedWith: [
          {
            userId: { _id: 'u1', toString: () => 'u1' },
            status: 'pending',
            role: 'member',
            _id: { getTimestamp: () => new Date('2025-01-01') },
          },
        ],
      }];
      SharedHabit.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(sharedHabits),
        }),
      });

      const result = await sharedHabitService.getPendingInvites('u1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('member');
    });
  });

  // ─── getUserRoleForHabit ────────────────────────────────────────

  describe('getUserRoleForHabit', () => {
    // getUserRoleForHabit uses mongoose.Types.ObjectId, so we need valid 24-char hex IDs
    const validHabitId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const validUserId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const validOwnerId = 'cccccccccccccccccccccccc';

    it('should return null if no shared habit found', async () => {
      SharedHabit.findOne.mockResolvedValue(null);

      const result = await sharedHabitService.getUserRoleForHabit(validUserId, validHabitId);
      expect(result).toBeNull();
    });

    it('should return owner for habit owner', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => validUserId },
        sharedWith: [],
      });

      const result = await sharedHabitService.getUserRoleForHabit(validUserId, validHabitId);
      expect(result).toBe('owner');
    });

    it('should return member role', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => validOwnerId },
        sharedWith: [
          { userId: { toString: () => validUserId }, status: 'accepted', role: 'admin' },
        ],
      });

      const result = await sharedHabitService.getUserRoleForHabit(validUserId, validHabitId);
      expect(result).toBe('admin');
    });

    it('should return null for non-member', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => validOwnerId },
        sharedWith: [],
      });

      const result = await sharedHabitService.getUserRoleForHabit(validUserId, validHabitId);
      expect(result).toBeNull();
    });
  });

  // ─── getSharedHabitIdsForUser ───────────────────────────────────

  describe('getSharedHabitIdsForUser', () => {
    it('should return habit ids with roles', async () => {
      SharedHabit.find.mockResolvedValue([
        {
          habitId: 'h1',
          ownerId: 'owner1',
          sharedWith: [
            { userId: { _id: 'u1', toString: () => 'u1' }, status: 'accepted', role: 'member' },
          ],
        },
      ]);

      const result = await sharedHabitService.getSharedHabitIdsForUser('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ habitId: 'h1', role: 'member' });
    });
  });
});

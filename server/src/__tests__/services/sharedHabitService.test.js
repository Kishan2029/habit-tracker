import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/SharedHabit.js', () => ({
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
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
    get: jest.fn(),
    set: jest.fn(),
    delByPrefix: jest.fn(),
  },
}));

const { default: SharedHabit } = await import('../../models/SharedHabit.js');
const { default: Habit } = await import('../../models/Habit.js');
const { default: User } = await import('../../models/User.js');
const { default: emailService } = await import('../../services/emailService.js');
const { default: cache } = await import('../../services/cacheService.js');
const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');

describe('SharedHabitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('_toId', () => {
    it('should return null for falsy input', () => {
      expect(sharedHabitService._toId(null)).toBeNull();
      expect(sharedHabitService._toId(undefined)).toBeNull();
    });

    it('should extract _id from object', () => {
      expect(sharedHabitService._toId({ _id: { toString: () => 'abc' } })).toBe('abc');
    });

    it('should call toString on primitive-like ref', () => {
      expect(sharedHabitService._toId({ toString: () => 'xyz' })).toBe('xyz');
    });
  });

  describe('_getRole', () => {
    it('should return owner for the owner', () => {
      const shared = {
        ownerId: { _id: { toString: () => 'u1' } },
        sharedWith: [],
      };
      expect(sharedHabitService._getRole(shared, 'u1')).toBe('owner');
    });

    it('should return role for accepted member', () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted', role: 'admin' }],
      };
      expect(sharedHabitService._getRole(shared, 'u2')).toBe('admin');
    });

    it('should return null for non-member', () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      };
      expect(sharedHabitService._getRole(shared, 'u3')).toBeNull();
    });

    it('should return null for pending member', () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'pending', role: 'member' }],
      };
      expect(sharedHabitService._getRole(shared, 'u2')).toBeNull();
    });
  });

  describe('_checkPermission', () => {
    it('should return true for valid permission', () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      };
      expect(sharedHabitService._checkPermission(shared, 'u1', 'deleteHabit')).toBe(true);
    });

    it('should return false for invalid permission', () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' }],
      };
      expect(sharedHabitService._checkPermission(shared, 'u2', 'deleteHabit')).toBe(false);
    });
  });

  describe('shareHabit', () => {
    it('should create new shared habit', async () => {
      Habit.findById.mockResolvedValue({ _id: 'h1', userId: { toString: () => 'u1' }, isArchived: false });
      SharedHabit.findOne.mockResolvedValue(null);
      SharedHabit.create.mockResolvedValue({ _id: 'sh1', habitId: 'h1', ownerId: 'u1' });

      const result = await sharedHabitService.shareHabit('u1', 'h1');

      expect(result._id).toBe('sh1');
      expect(SharedHabit.create).toHaveBeenCalled();
    });

    it('should throw 404 if habit not found', async () => {
      Habit.findById.mockResolvedValue(null);

      await expect(sharedHabitService.shareHabit('u1', 'h1'))
        .rejects.toMatchObject({ message: 'Habit not found', statusCode: 404 });
    });

    it('should throw 403 if not owner', async () => {
      Habit.findById.mockResolvedValue({ _id: 'h1', userId: { toString: () => 'u2' } });

      await expect(sharedHabitService.shareHabit('u1', 'h1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 400 if habit is archived', async () => {
      Habit.findById.mockResolvedValue({ _id: 'h1', userId: { toString: () => 'u1' }, isArchived: true });

      await expect(sharedHabitService.shareHabit('u1', 'h1'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('should return existing active shared habit', async () => {
      Habit.findById.mockResolvedValue({ _id: 'h1', userId: { toString: () => 'u1' }, isArchived: false });
      SharedHabit.findOne.mockResolvedValue({ _id: 'sh1', isActive: true });

      const result = await sharedHabitService.shareHabit('u1', 'h1');

      expect(result._id).toBe('sh1');
      expect(SharedHabit.create).not.toHaveBeenCalled();
    });

    it('should reactivate inactive shared habit', async () => {
      Habit.findById.mockResolvedValue({ _id: 'h1', userId: { toString: () => 'u1' }, isArchived: false });
      const inactiveShared = {
        _id: 'sh1',
        isActive: false,
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(inactiveShared);

      const result = await sharedHabitService.shareHabit('u1', 'h1');

      expect(result.isActive).toBe(true);
      expect(inactiveShared.save).toHaveBeenCalled();
    });
  });

  describe('joinByInviteCode', () => {
    it('should add new member', async () => {
      const shared = {
        _id: 'sh1',
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.joinByInviteCode('u2', 'code123');

      expect(shared.sharedWith).toHaveLength(1);
      expect(shared.sharedWith[0].userId).toBe('u2');
      expect(shared.sharedWith[0].status).toBe('accepted');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
    });

    it('should throw 404 for invalid invite code', async () => {
      SharedHabit.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.joinByInviteCode('u2', 'badcode'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if owner tries to join own habit', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.joinByInviteCode('u1', 'code123'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 if already joined', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted' }],
      });

      await expect(sharedHabitService.joinByInviteCode('u2', 'code123'))
        .rejects.toMatchObject({ statusCode: 400, message: 'You have already joined this habit' });
    });

    it('should auto-accept pending invite', async () => {
      const pendingMember = { userId: { toString: () => 'u2' }, status: 'pending' };
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [pendingMember],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.joinByInviteCode('u2', 'code123');

      expect(pendingMember.status).toBe('accepted');
    });

    it('should allow re-joining after decline', async () => {
      const declinedMember = { userId: { toString: () => 'u2' }, status: 'declined', role: 'viewer' };
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [declinedMember],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.joinByInviteCode('u2', 'code123');

      expect(declinedMember.status).toBe('accepted');
      expect(declinedMember.role).toBe('member');
    });
  });

  describe('inviteMember', () => {
    it('should invite a new member', async () => {
      const shared = {
        _id: 'sh1',
        ownerId: { toString: () => 'u1' },
        inviteCode: 'code123',
        sharedWith: [],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: 'u2', email: 'user2@test.com', name: 'User2' });
      User.findById.mockResolvedValue({ name: 'Owner' });
      Habit.findById.mockResolvedValue({ name: 'Exercise' });
      emailService.sendHabitInviteEmail.mockResolvedValue();

      const result = await sharedHabitService.inviteMember('u1', 'h1', 'user2@test.com', 'member');

      expect(shared.sharedWith).toHaveLength(1);
      expect(result.emailSent).toBe(true);
    });

    it('should throw 403 if no invite permission', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u3' }, status: 'accepted', role: 'member' }],
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.inviteMember('u3', 'h1', 'user2@test.com'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if target user not found', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      };
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue(null);

      await expect(sharedHabitService.inviteMember('u1', 'h1', 'nonexistent@test.com'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if inviting the owner', async () => {
      const shared = {
        ownerId: { _id: { toString: () => 'u1' } },
        sharedWith: [],
      };
      SharedHabit.findOne.mockResolvedValue(shared);
      User.findOne.mockResolvedValue({ _id: { toString: () => 'u1' }, email: 'owner@test.com', name: 'Owner' });

      await expect(sharedHabitService.inviteMember('u1', 'h1', 'owner@test.com'))
        .rejects.toMatchObject({ statusCode: 400, message: 'Cannot invite the habit owner' });
    });
  });

  describe('respondToInvite', () => {
    it('should accept invite', async () => {
      const member = { userId: { toString: () => 'u2' }, status: 'pending' };
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [member],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.respondToInvite('u2', 'h1', true);

      expect(member.status).toBe('accepted');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
    });

    it('should decline invite', async () => {
      const member = { userId: { toString: () => 'u2' }, status: 'pending' };
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [member],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.respondToInvite('u2', 'h1', false);

      expect(member.status).toBe('declined');
      expect(cache.delByPrefix).not.toHaveBeenCalled();
    });

    it('should throw 404 if no pending invite', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.respondToInvite('u2', 'h1', true))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [
          { userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' },
        ],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.removeMember('u1', 'h1', 'u2');

      expect(shared.sharedWith).toHaveLength(0);
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
    });

    it('should throw 403 if no permission', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [
          { userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' },
          { userId: { toString: () => 'u3' }, status: 'accepted', role: 'member' },
        ],
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.removeMember('u2', 'h1', 'u3'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 403 if admin tries to remove another admin', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [
          { userId: { toString: () => 'u2' }, status: 'accepted', role: 'admin' },
          { userId: { toString: () => 'u3' }, status: 'accepted', role: 'admin' },
        ],
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.removeMember('u2', 'h1', 'u3'))
        .rejects.toMatchObject({ statusCode: 403, message: 'Admins cannot remove other admins' });
    });
  });

  describe('leaveSharedHabit', () => {
    it('should allow member to leave', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' }],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.leaveSharedHabit('u2', 'h1');

      expect(result.message).toBe('Left shared habit');
      expect(shared.sharedWith).toHaveLength(0);
    });

    it('should throw 400 if owner tries to leave', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.leaveSharedHabit('u1', 'h1'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 if not a member', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.leaveSharedHabit('u3', 'h1'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateMemberRole', () => {
    it('should update role', async () => {
      const member = { userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' };
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [member],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await sharedHabitService.updateMemberRole('u1', 'h1', 'u2', 'admin');

      expect(member.role).toBe('admin');
    });

    it('should throw 403 if not owner', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [
          { userId: { toString: () => 'u2' }, status: 'accepted', role: 'admin' },
        ],
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      await expect(sharedHabitService.updateMemberRole('u2', 'h1', 'u3', 'member'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' }],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);
      Habit.findByIdAndUpdate.mockResolvedValue({});

      await sharedHabitService.transferOwnership('u1', 'h1', 'u2');

      expect(Habit.findByIdAndUpdate).toHaveBeenCalledWith('h1', { userId: 'u2' });
      expect(shared.ownerId).toBe('u2');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u1');
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
    });

    it('should throw 403 if not owner', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.transferOwnership('u2', 'h1', 'u3'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 400 if new owner is not accepted member', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'pending', role: 'member' }],
      });

      await expect(sharedHabitService.transferOwnership('u1', 'h1', 'u2'))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('regenerateInviteCode', () => {
    it('should regenerate invite code', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.regenerateInviteCode('u1', 'h1');

      expect(result.inviteCode).toBeDefined();
      expect(shared.save).toHaveBeenCalled();
    });

    it('should throw 403 if no invite permission', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' }, status: 'accepted', role: 'member' }],
      });

      await expect(sharedHabitService.regenerateInviteCode('u2', 'h1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('unshareHabit', () => {
    it('should deactivate shared habit', async () => {
      const shared = {
        ownerId: { toString: () => 'u1' },
        sharedWith: [{ userId: { toString: () => 'u2' } }],
        save: jest.fn().mockResolvedValue({}),
      };
      SharedHabit.findOne.mockResolvedValue(shared);

      const result = await sharedHabitService.unshareHabit('u1', 'h1');

      expect(result.message).toBe('Habit unshared');
      expect(shared.isActive).toBe(false);
      expect(cache.delByPrefix).toHaveBeenCalledWith('habits:u2');
    });

    it('should throw 403 if not owner', async () => {
      SharedHabit.findOne.mockResolvedValue({
        ownerId: { toString: () => 'u1' },
        sharedWith: [],
      });

      await expect(sharedHabitService.unshareHabit('u2', 'h1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });
});

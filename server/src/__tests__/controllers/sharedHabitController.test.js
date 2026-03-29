import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/sharedHabitService.js', () => ({
  default: {
    shareHabit: jest.fn(),
    _populateShared: jest.fn(),
    joinByInviteCode: jest.fn(),
    inviteMember: jest.fn(),
    respondToInvite: jest.fn(),
    removeMember: jest.fn(),
    leaveSharedHabit: jest.fn(),
    updateMemberRole: jest.fn(),
    transferOwnership: jest.fn(),
    getSharedHabitsForUser: jest.fn(),
    getPendingInvites: jest.fn(),
    getSharingInfo: jest.fn(),
    regenerateInviteCode: jest.fn(),
    unshareHabit: jest.fn(),
  },
}));

const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');
const {
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
} = await import('../../controllers/sharedHabitController.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('SharedHabitController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('shareHabit', () => {
    it('should share habit and return 201', async () => {
      const shared = { _id: 'sh1' };
      const populated = { _id: 'sh1', ownerId: { name: 'John' } };
      sharedHabitService.shareHabit.mockResolvedValue(shared);
      sharedHabitService._populateShared.mockResolvedValue(populated);

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1' } };
      shareHabit(req, res, next);
      await flushPromises();

      expect(sharedHabitService.shareHabit).toHaveBeenCalledWith('u1', 'h1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { shared: populated, requesterRole: 'owner' } })
      );
    });
  });

  describe('joinByInviteCode', () => {
    it('should join shared habit by invite code', async () => {
      const shared = { _id: 'sh1' };
      sharedHabitService.joinByInviteCode.mockResolvedValue(shared);

      const req = { user: { _id: 'u1' }, body: { inviteCode: 'abc123' } };
      await joinByInviteCode(req, res, next);

      expect(sharedHabitService.joinByInviteCode).toHaveBeenCalledWith('u1', 'abc123');
    });
  });

  describe('inviteMember', () => {
    it('should invite member and return email status', async () => {
      sharedHabitService.inviteMember.mockResolvedValue({
        shared: { _id: 'sh1' },
        emailSent: true,
        emailError: null,
      });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', email: 'test@test.com', role: 'member' } };
      await inviteMember(req, res, next);

      expect(sharedHabitService.inviteMember).toHaveBeenCalledWith('u1', 'h1', 'test@test.com', 'member');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invite sent via email' })
      );
    });

    it('should show fallback message when email fails', async () => {
      sharedHabitService.inviteMember.mockResolvedValue({
        shared: { _id: 'sh1' },
        emailSent: false,
        emailError: 'SMTP down',
      });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', email: 'test@test.com', role: 'member' } };
      await inviteMember(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Member added to invite list (email notification could not be sent)' })
      );
    });
  });

  describe('respondToInvite', () => {
    it('should accept invite', async () => {
      sharedHabitService.respondToInvite.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', accept: true } };
      await respondToInvite(req, res, next);

      expect(sharedHabitService.respondToInvite).toHaveBeenCalledWith('u1', 'h1', true);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invite accepted' })
      );
    });

    it('should decline invite', async () => {
      sharedHabitService.respondToInvite.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', accept: false } };
      await respondToInvite(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invite declined' })
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      sharedHabitService.removeMember.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1', userId: 'u2' } };
      await removeMember(req, res, next);

      expect(sharedHabitService.removeMember).toHaveBeenCalledWith('u1', 'h1', 'u2');
    });
  });

  describe('leaveHabit', () => {
    it('should leave shared habit', async () => {
      sharedHabitService.leaveSharedHabit.mockResolvedValue({ message: 'Left shared habit' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await leaveHabit(req, res, next);

      expect(sharedHabitService.leaveSharedHabit).toHaveBeenCalledWith('u1', 'h1');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      sharedHabitService.updateMemberRole.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1', userId: 'u2' }, body: { role: 'admin' } };
      await updateMemberRole(req, res, next);

      expect(sharedHabitService.updateMemberRole).toHaveBeenCalledWith('u1', 'h1', 'u2', 'admin');
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership', async () => {
      sharedHabitService.transferOwnership.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' }, body: { newOwnerId: 'u2' } };
      await transferOwnership(req, res, next);

      expect(sharedHabitService.transferOwnership).toHaveBeenCalledWith('u1', 'h1', 'u2');
    });
  });

  describe('getSharedWithMe', () => {
    it('should return shared habits', async () => {
      const habits = [{ _id: 'sh1' }];
      sharedHabitService.getSharedHabitsForUser.mockResolvedValue(habits);

      const req = { user: { _id: 'u1' } };
      await getSharedWithMe(req, res, next);

      expect(sharedHabitService.getSharedHabitsForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('getPendingInvites', () => {
    it('should return pending invites', async () => {
      const invites = [{ habitId: 'h1' }];
      sharedHabitService.getPendingInvites.mockResolvedValue(invites);

      const req = { user: { _id: 'u1' } };
      await getPendingInvites(req, res, next);

      expect(sharedHabitService.getPendingInvites).toHaveBeenCalledWith('u1');
    });
  });

  describe('getSharingInfo', () => {
    it('should return sharing info', async () => {
      const result = { shared: { _id: 'sh1' }, requesterRole: 'owner' };
      sharedHabitService.getSharingInfo.mockResolvedValue(result);

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await getSharingInfo(req, res, next);

      expect(sharedHabitService.getSharingInfo).toHaveBeenCalledWith('u1', 'h1');
    });
  });

  describe('regenerateInviteCode', () => {
    it('should regenerate invite code', async () => {
      sharedHabitService.regenerateInviteCode.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await regenerateInviteCode(req, res, next);

      expect(sharedHabitService.regenerateInviteCode).toHaveBeenCalledWith('u1', 'h1');
    });
  });

  describe('unshareHabit', () => {
    it('should unshare habit', async () => {
      sharedHabitService.unshareHabit.mockResolvedValue({ message: 'Habit unshared' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await unshareHabit(req, res, next);

      expect(sharedHabitService.unshareHabit).toHaveBeenCalledWith('u1', 'h1');
    });
  });
});

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

describe('SharedHabitController', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = jest.fn();
  });

  describe('shareHabit', () => {
    it('should share habit and return 201', async () => {
      const mockShared = { _id: 'sh1', habitId: 'h1' };
      const mockPopulated = { ...mockShared, ownerId: { name: 'John' } };
      sharedHabitService.shareHabit.mockResolvedValue(mockShared);
      sharedHabitService._populateShared.mockResolvedValue(mockPopulated);

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1' } };
      // Use next-callback pattern to reliably await multi-step catchAsync handlers
      await new Promise((resolve) => {
        const wrappedRes = {
          status: jest.fn().mockReturnValue({ json: jest.fn().mockImplementation(() => { resolve(); return wrappedRes; }) }),
          json: jest.fn().mockImplementation(() => { resolve(); return wrappedRes; }),
        };
        Object.assign(res, wrappedRes);
        shareHabit(req, res, next);
      });

      expect(sharedHabitService.shareHabit).toHaveBeenCalledWith('u1', 'h1');
      expect(sharedHabitService._populateShared).toHaveBeenCalledWith(mockShared);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('joinByInviteCode', () => {
    it('should join and return 200', async () => {
      const mockShared = { _id: 'sh1' };
      sharedHabitService.joinByInviteCode.mockResolvedValue(mockShared);

      const req = { user: { _id: 'u1' }, body: { inviteCode: 'code123' } };
      await joinByInviteCode(req, res, next);

      expect(sharedHabitService.joinByInviteCode).toHaveBeenCalledWith('u1', 'code123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Joined shared habit' })
      );
    });
  });

  describe('inviteMember', () => {
    it('should invite and show email sent message', async () => {
      sharedHabitService.inviteMember.mockResolvedValue({
        shared: { _id: 'sh1' },
        emailSent: true,
        emailError: null,
      });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', email: 'bob@test.com', role: 'member' } };
      await inviteMember(req, res, next);

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

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', email: 'bob@test.com' } };
      await inviteMember(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Member added to invite list (email notification could not be sent)',
        })
      );
    });
  });

  describe('respondToInvite', () => {
    it('should accept invite', async () => {
      sharedHabitService.respondToInvite.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, body: { habitId: 'h1', accept: true } };
      await respondToInvite(req, res, next);

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
    it('should remove member and return 200', async () => {
      sharedHabitService.removeMember.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1', userId: 'u2' } };
      await removeMember(req, res, next);

      expect(sharedHabitService.removeMember).toHaveBeenCalledWith('u1', 'h1', 'u2');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Member removed' })
      );
    });
  });

  describe('leaveHabit', () => {
    it('should leave habit and return 200', async () => {
      sharedHabitService.leaveSharedHabit.mockResolvedValue({ message: 'Left shared habit' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await leaveHabit(req, res, next);

      expect(sharedHabitService.leaveSharedHabit).toHaveBeenCalledWith('u1', 'h1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Left shared habit' })
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update role and return 200', async () => {
      sharedHabitService.updateMemberRole.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1', userId: 'u2' }, body: { role: 'admin' } };
      await updateMemberRole(req, res, next);

      expect(sharedHabitService.updateMemberRole).toHaveBeenCalledWith('u1', 'h1', 'u2', 'admin');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Role updated' })
      );
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership and return 200', async () => {
      sharedHabitService.transferOwnership.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' }, body: { newOwnerId: 'u2' } };
      await transferOwnership(req, res, next);

      expect(sharedHabitService.transferOwnership).toHaveBeenCalledWith('u1', 'h1', 'u2');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Ownership transferred' })
      );
    });
  });

  describe('getSharedWithMe', () => {
    it('should return shared habits', async () => {
      const mockHabits = [{ _id: 'sh1' }];
      sharedHabitService.getSharedHabitsForUser.mockResolvedValue(mockHabits);

      const req = { user: { _id: 'u1' } };
      await getSharedWithMe(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { sharedHabits: mockHabits },
          message: 'Shared habits retrieved',
        })
      );
    });
  });

  describe('getPendingInvites', () => {
    it('should return pending invites', async () => {
      const mockInvites = [{ habitId: 'h1' }];
      sharedHabitService.getPendingInvites.mockResolvedValue(mockInvites);

      const req = { user: { _id: 'u1' } };
      await getPendingInvites(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { invites: mockInvites },
          message: 'Pending invites retrieved',
        })
      );
    });
  });

  describe('getSharingInfo', () => {
    it('should return sharing info', async () => {
      const mockResult = { shared: { _id: 'sh1' }, requesterRole: 'owner' };
      sharedHabitService.getSharingInfo.mockResolvedValue(mockResult);

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await getSharingInfo(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockResult,
          message: 'Sharing info retrieved',
        })
      );
    });
  });

  describe('regenerateInviteCode', () => {
    it('should regenerate invite code and return 200', async () => {
      sharedHabitService.regenerateInviteCode.mockResolvedValue({ _id: 'sh1' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await regenerateInviteCode(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invite code regenerated' })
      );
    });
  });

  describe('unshareHabit', () => {
    it('should unshare habit and return 200', async () => {
      sharedHabitService.unshareHabit.mockResolvedValue({ message: 'Habit unshared' });

      const req = { user: { _id: 'u1' }, params: { habitId: 'h1' } };
      await unshareHabit(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Habit unshared' })
      );
    });
  });
});

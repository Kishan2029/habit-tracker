import { describe, it, expect } from '@jest/globals';
import {
  shareHabitRules,
  joinByCodeRules,
  inviteMemberRules,
  respondToInviteRules,
  updateRoleRules,
  transferOwnershipRules,
  habitIdParamRules,
  removeMemberRules,
} from '../../validators/sharedHabitValidators.js';

describe('SharedHabit Validators', () => {
  describe('shareHabitRules', () => {
    it('should have 1 rule for habitId', () => {
      expect(shareHabitRules).toHaveLength(1);
    });
  });

  describe('joinByCodeRules', () => {
    it('should have 1 rule for inviteCode', () => {
      expect(joinByCodeRules).toHaveLength(1);
    });
  });

  describe('inviteMemberRules', () => {
    it('should have 3 rules for habitId, email, and role', () => {
      expect(inviteMemberRules).toHaveLength(3);
    });
  });

  describe('respondToInviteRules', () => {
    it('should have 2 rules for habitId and accept', () => {
      expect(respondToInviteRules).toHaveLength(2);
    });
  });

  describe('updateRoleRules', () => {
    it('should have 3 rules for habitId param, userId param, and role body', () => {
      expect(updateRoleRules).toHaveLength(3);
    });
  });

  describe('transferOwnershipRules', () => {
    it('should have 2 rules for habitId param and newOwnerId body', () => {
      expect(transferOwnershipRules).toHaveLength(2);
    });
  });

  describe('habitIdParamRules', () => {
    it('should have 1 rule for habitId param', () => {
      expect(habitIdParamRules).toHaveLength(1);
    });
  });

  describe('removeMemberRules', () => {
    it('should have 2 rules for habitId and userId params', () => {
      expect(removeMemberRules).toHaveLength(2);
    });
  });
});

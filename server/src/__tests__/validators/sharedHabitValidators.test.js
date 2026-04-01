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
import { runValidation, expectErrors, expectExactErrors, expectNoErrors } from './helpers.js';

const VALID_MONGO_ID = '507f1f77bcf86cd799439011';
const VALID_MONGO_ID_2 = '507f1f77bcf86cd799439012';

describe('SharedHabit Validators', () => {
  describe('shareHabitRules', () => {
    it('should pass with valid habitId', async () => {
      const errors = await runValidation(shareHabitRules, {
        body: { habitId: VALID_MONGO_ID },
      });
      expectNoErrors(errors);
    });

    it('should reject missing habitId', async () => {
      const errors = await runValidation(shareHabitRules, { body: {} });
      expectErrors(errors, ['habitId']);
    });

    it('should reject invalid MongoDB ID', async () => {
      const errors = await runValidation(shareHabitRules, {
        body: { habitId: 'not-valid' },
      });
      expectErrors(errors, ['habitId']);
    });
  });

  describe('joinByCodeRules', () => {
    it('should pass with valid alphanumeric invite code', async () => {
      const errors = await runValidation(joinByCodeRules, {
        body: { inviteCode: 'abc123' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing invite code', async () => {
      const errors = await runValidation(joinByCodeRules, { body: {} });
      expectErrors(errors, ['inviteCode']);
    });

    it('should reject non-alphanumeric invite code', async () => {
      const errors = await runValidation(joinByCodeRules, {
        body: { inviteCode: 'abc-123!' },
      });
      expectErrors(errors, ['inviteCode']);
    });
  });

  describe('inviteMemberRules', () => {
    it('should pass with valid habitId, email, and optional role', async () => {
      const errors = await runValidation(inviteMemberRules, {
        body: { habitId: VALID_MONGO_ID, email: 'user@example.com', role: 'member' },
      });
      expectNoErrors(errors);
    });

    it('should pass without role (optional)', async () => {
      const errors = await runValidation(inviteMemberRules, {
        body: { habitId: VALID_MONGO_ID, email: 'user@example.com' },
      });
      expectNoErrors(errors);
    });

    it('should reject invalid email', async () => {
      const errors = await runValidation(inviteMemberRules, {
        body: { habitId: VALID_MONGO_ID, email: 'not-an-email' },
      });
      expectErrors(errors, ['email']);
    });

    it('should reject invalid role', async () => {
      const errors = await runValidation(inviteMemberRules, {
        body: { habitId: VALID_MONGO_ID, email: 'user@example.com', role: 'superadmin' },
      });
      expectErrors(errors, ['role']);
    });
  });

  describe('respondToInviteRules', () => {
    it('should pass with valid habitId and accept boolean', async () => {
      const errors = await runValidation(respondToInviteRules, {
        body: { habitId: VALID_MONGO_ID, accept: true },
      });
      expectNoErrors(errors);
    });

    it('should reject non-boolean accept', async () => {
      const errors = await runValidation(respondToInviteRules, {
        body: { habitId: VALID_MONGO_ID, accept: 'yes' },
      });
      expectErrors(errors, ['accept']);
    });
  });

  describe('updateRoleRules', () => {
    it('should pass with valid params and role', async () => {
      const errors = await runValidation(updateRoleRules, {
        params: { habitId: VALID_MONGO_ID, userId: VALID_MONGO_ID_2 },
        body: { role: 'admin' },
      });
      expectNoErrors(errors);
    });

    it('should reject invalid habitId param', async () => {
      const errors = await runValidation(updateRoleRules, {
        params: { habitId: 'bad', userId: VALID_MONGO_ID_2 },
        body: { role: 'admin' },
      });
      expectErrors(errors, ['habitId']);
    });

    it('should reject invalid role value', async () => {
      const errors = await runValidation(updateRoleRules, {
        params: { habitId: VALID_MONGO_ID, userId: VALID_MONGO_ID_2 },
        body: { role: 'owner' },
      });
      expectErrors(errors, ['role']);
    });
  });

  describe('transferOwnershipRules', () => {
    it('should pass with valid habitId param and newOwnerId', async () => {
      const errors = await runValidation(transferOwnershipRules, {
        params: { habitId: VALID_MONGO_ID },
        body: { newOwnerId: VALID_MONGO_ID_2 },
      });
      expectNoErrors(errors);
    });

    it('should reject missing newOwnerId', async () => {
      const errors = await runValidation(transferOwnershipRules, {
        params: { habitId: VALID_MONGO_ID },
        body: {},
      });
      expectErrors(errors, ['newOwnerId']);
    });
  });

  describe('habitIdParamRules', () => {
    it('should pass with valid habitId param', async () => {
      const errors = await runValidation(habitIdParamRules, {
        params: { habitId: VALID_MONGO_ID },
      });
      expectNoErrors(errors);
    });

    it('should reject invalid habitId param', async () => {
      const errors = await runValidation(habitIdParamRules, {
        params: { habitId: 'invalid' },
      });
      expectErrors(errors, ['habitId']);
    });
  });

  describe('removeMemberRules', () => {
    it('should pass with valid habitId and userId params', async () => {
      const errors = await runValidation(removeMemberRules, {
        params: { habitId: VALID_MONGO_ID, userId: VALID_MONGO_ID_2 },
      });
      expectNoErrors(errors);
    });

    it('should reject invalid userId param', async () => {
      const errors = await runValidation(removeMemberRules, {
        params: { habitId: VALID_MONGO_ID, userId: 'bad-id' },
      });
      expectErrors(errors, ['userId']);
    });
  });
});

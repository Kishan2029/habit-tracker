import { describe, it, expect } from '@jest/globals';
import { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, changePasswordRules } from '../../validators/authValidators.js';

describe('Auth Validators', () => {
  describe('registerRules', () => {
    it('should have 3 validation rules', () => {
      expect(registerRules).toHaveLength(3);
    });

    it('should export an array of middleware', () => {
      registerRules.forEach((rule) => {
        expect(rule).toBeDefined();
      });
    });
  });

  describe('loginRules', () => {
    it('should have 2 validation rules', () => {
      expect(loginRules).toHaveLength(2);
    });
  });

  describe('forgotPasswordRules', () => {
    it('should have 1 validation rule', () => {
      expect(forgotPasswordRules).toHaveLength(1);
    });
  });

  describe('resetPasswordRules', () => {
    it('should have 2 validation rules', () => {
      expect(resetPasswordRules).toHaveLength(2);
    });
  });

  describe('changePasswordRules', () => {
    it('should have 2 validation rules', () => {
      expect(changePasswordRules).toHaveLength(2);
    });
  });
});

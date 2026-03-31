import { describe, it, expect } from '@jest/globals';
import { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, changePasswordRules } from '../../validators/authValidators.js';
import { runValidation, expectErrors, expectExactErrors, expectNoErrors } from './helpers.js';

describe('Auth Validators', () => {
  describe('registerRules', () => {
    it('should pass with valid input', async () => {
      const errors = await runValidation(registerRules, {
        body: { name: 'Alice', email: 'alice@example.com', password: 'secret123' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing name, email, and password', async () => {
      const errors = await runValidation(registerRules, { body: {} });
      expectExactErrors(errors, ['name', 'email', 'password']);
    });

    it('should reject invalid email format', async () => {
      const errors = await runValidation(registerRules, {
        body: { name: 'Alice', email: 'not-an-email', password: 'secret123' },
      });
      expectErrors(errors, ['email']);
    });

    it('should reject password shorter than 6 characters', async () => {
      const errors = await runValidation(registerRules, {
        body: { name: 'Alice', email: 'alice@example.com', password: '12345' },
      });
      expectErrors(errors, ['password']);
    });

    it('should reject name longer than 100 characters', async () => {
      const errors = await runValidation(registerRules, {
        body: { name: 'A'.repeat(101), email: 'alice@example.com', password: 'secret123' },
      });
      expectErrors(errors, ['name']);
    });
  });

  describe('loginRules', () => {
    it('should pass with valid input', async () => {
      const errors = await runValidation(loginRules, {
        body: { email: 'alice@example.com', password: 'secret123' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing email and password', async () => {
      const errors = await runValidation(loginRules, { body: {} });
      expectExactErrors(errors, ['email', 'password']);
    });
  });

  describe('forgotPasswordRules', () => {
    it('should pass with valid email', async () => {
      const errors = await runValidation(forgotPasswordRules, {
        body: { email: 'alice@example.com' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing email', async () => {
      const errors = await runValidation(forgotPasswordRules, { body: {} });
      expectErrors(errors, ['email']);
    });
  });

  describe('resetPasswordRules', () => {
    it('should pass with valid token and password', async () => {
      const errors = await runValidation(resetPasswordRules, {
        body: { token: 'a'.repeat(64), newPassword: 'newpass123' },
      });
      expectNoErrors(errors);
    });

    it('should reject non-hex token', async () => {
      const errors = await runValidation(resetPasswordRules, {
        body: { token: 'z'.repeat(64), newPassword: 'newpass123' },
      });
      expectErrors(errors, ['token']);
    });

    it('should reject token with wrong length', async () => {
      const errors = await runValidation(resetPasswordRules, {
        body: { token: 'a'.repeat(32), newPassword: 'newpass123' },
      });
      expectErrors(errors, ['token']);
    });

    it('should reject short new password', async () => {
      const errors = await runValidation(resetPasswordRules, {
        body: { token: 'a'.repeat(64), newPassword: '123' },
      });
      expectErrors(errors, ['newPassword']);
    });
  });

  describe('changePasswordRules', () => {
    it('should pass with valid passwords', async () => {
      const errors = await runValidation(changePasswordRules, {
        body: { currentPassword: 'oldpass', newPassword: 'newpass123' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing current and new passwords', async () => {
      const errors = await runValidation(changePasswordRules, { body: {} });
      expectExactErrors(errors, ['currentPassword', 'newPassword']);
    });

    it('should reject short new password', async () => {
      const errors = await runValidation(changePasswordRules, {
        body: { currentPassword: 'oldpass', newPassword: '12345' },
      });
      expectErrors(errors, ['newPassword']);
    });
  });
});

import { describe, it, expect } from '@jest/globals';
import { createHabitRules, updateHabitRules, reorderHabitRules } from '../../validators/habitValidators.js';
import { runValidation, expectErrors, expectNoErrors } from './helpers.js';

describe('Habit Validators', () => {
  describe('createHabitRules', () => {
    it('should pass with only a name (other fields optional)', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing name', async () => {
      const errors = await runValidation(createHabitRules, { body: {} });
      expectErrors(errors, ['name']);
    });

    it('should reject name longer than 100 characters', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'A'.repeat(101) },
      });
      expectErrors(errors, ['name']);
    });

    it('should reject invalid type', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise', type: 'invalid' },
      });
      expectErrors(errors, ['type']);
    });

    it('should reject invalid hex color', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise', color: 'red' },
      });
      expectErrors(errors, ['color']);
    });

    it('should accept valid hex color', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise', color: '#FF5733' },
      });
      expectNoErrors(errors);
    });

    it('should reject non-positive target', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise', target: 0 },
      });
      expectErrors(errors, ['target']);
    });

    it('should reject frequency day outside 0-6', async () => {
      const errors = await runValidation(createHabitRules, {
        body: { name: 'Exercise', frequency: [7] },
      });
      expectErrors(errors, ['frequency[0]']);
    });
  });

  describe('updateHabitRules', () => {
    it('should pass with empty body (all fields optional)', async () => {
      const errors = await runValidation(updateHabitRules, { body: {} });
      expectNoErrors(errors);
    });

    it('should reject invalid type when provided', async () => {
      const errors = await runValidation(updateHabitRules, {
        body: { type: 'invalid' },
      });
      expectErrors(errors, ['type']);
    });
  });

  describe('reorderHabitRules', () => {
    it('should pass with valid items array', async () => {
      const errors = await runValidation(reorderHabitRules, {
        body: {
          items: [
            { id: '507f1f77bcf86cd799439011', sortOrder: 0 },
            { id: '507f1f77bcf86cd799439012', sortOrder: 1 },
          ],
        },
      });
      expectNoErrors(errors);
    });

    it('should reject empty items array', async () => {
      const errors = await runValidation(reorderHabitRules, {
        body: { items: [] },
      });
      expectErrors(errors, ['items']);
    });

    it('should reject invalid MongoDB ID in items', async () => {
      const errors = await runValidation(reorderHabitRules, {
        body: { items: [{ id: 'not-a-mongo-id', sortOrder: 0 }] },
      });
      expectErrors(errors, ['items[0].id']);
    });

    it('should reject negative sortOrder', async () => {
      const errors = await runValidation(reorderHabitRules, {
        body: { items: [{ id: '507f1f77bcf86cd799439011', sortOrder: -1 }] },
      });
      expectErrors(errors, ['items[0].sortOrder']);
    });
  });
});

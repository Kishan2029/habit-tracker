import { describe, it, expect } from '@jest/globals';
import { createHabitRules, updateHabitRules, reorderHabitRules } from '../../validators/habitValidators.js';

describe('Habit Validators', () => {
  describe('createHabitRules', () => {
    it('should have validation rules for creating a habit', () => {
      expect(createHabitRules.length).toBeGreaterThan(0);
    });

    it('should export an array of middleware', () => {
      createHabitRules.forEach((rule) => {
        expect(rule).toBeDefined();
      });
    });
  });

  describe('updateHabitRules', () => {
    it('should have validation rules for updating a habit', () => {
      expect(updateHabitRules.length).toBeGreaterThan(0);
    });
  });

  describe('reorderHabitRules', () => {
    it('should have validation rules for reordering habits', () => {
      expect(reorderHabitRules.length).toBeGreaterThan(0);
    });

    it('should validate items array and sortOrder', () => {
      // reorderHabitRules validates items array, items.*.id, and items.*.sortOrder
      expect(reorderHabitRules).toHaveLength(3);
    });
  });
});

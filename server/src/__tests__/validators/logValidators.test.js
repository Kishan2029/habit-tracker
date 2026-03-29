import { describe, it, expect } from '@jest/globals';
import { createLogRules, dailyQueryRules, monthlyQueryRules, yearlyQueryRules, rangeQueryRules } from '../../validators/logValidators.js';

describe('Log Validators', () => {
  describe('createLogRules', () => {
    it('should have 4 validation rules', () => {
      expect(createLogRules).toHaveLength(4);
    });
  });

  describe('dailyQueryRules', () => {
    it('should have 1 validation rule for date', () => {
      expect(dailyQueryRules).toHaveLength(1);
    });
  });

  describe('monthlyQueryRules', () => {
    it('should have 2 validation rules for month and year', () => {
      expect(monthlyQueryRules).toHaveLength(2);
    });
  });

  describe('yearlyQueryRules', () => {
    it('should have 1 validation rule for year', () => {
      expect(yearlyQueryRules).toHaveLength(1);
    });
  });

  describe('rangeQueryRules', () => {
    it('should have 2 validation rules for start and end', () => {
      expect(rangeQueryRules).toHaveLength(2);
    });
  });
});

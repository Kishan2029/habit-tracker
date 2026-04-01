import { describe, it, expect } from '@jest/globals';
import { createLogRules, dailyQueryRules, monthlyQueryRules, yearlyQueryRules, rangeQueryRules } from '../../validators/logValidators.js';
import { runValidation, expectErrors, expectExactErrors, expectNoErrors } from './helpers.js';

const VALID_MONGO_ID = '507f1f77bcf86cd799439011';

describe('Log Validators', () => {
  describe('createLogRules', () => {
    it('should pass with valid boolean log', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: VALID_MONGO_ID, date: '2024-06-15', value: true },
      });
      expectNoErrors(errors);
    });

    it('should pass with valid numeric log', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: VALID_MONGO_ID, date: '2024-06-15', value: 5 },
      });
      expectNoErrors(errors);
    });

    it('should reject missing required fields', async () => {
      const errors = await runValidation(createLogRules, { body: {} });
      expectExactErrors(errors, ['habitId', 'date', 'value']);
    });

    it('should reject invalid MongoDB ID', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: 'bad-id', date: '2024-06-15', value: true },
      });
      expectErrors(errors, ['habitId']);
    });

    it('should reject invalid date format', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: VALID_MONGO_ID, date: '15/06/2024', value: true },
      });
      expectErrors(errors, ['date']);
    });

    it('should reject negative numeric value', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: VALID_MONGO_ID, date: '2024-06-15', value: -1 },
      });
      expectErrors(errors, ['value']);
    });

    it('should reject notes longer than 500 characters', async () => {
      const errors = await runValidation(createLogRules, {
        body: { habitId: VALID_MONGO_ID, date: '2024-06-15', value: true, notes: 'A'.repeat(501) },
      });
      expectErrors(errors, ['notes']);
    });
  });

  describe('dailyQueryRules', () => {
    it('should pass with valid date', async () => {
      const errors = await runValidation(dailyQueryRules, {
        query: { date: '2024-06-15' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing date', async () => {
      const errors = await runValidation(dailyQueryRules, { query: {} });
      expectErrors(errors, ['date']);
    });
  });

  describe('monthlyQueryRules', () => {
    it('should pass with valid month and year', async () => {
      const errors = await runValidation(monthlyQueryRules, {
        query: { month: '6', year: '2024' },
      });
      expectNoErrors(errors);
    });

    it('should reject month outside 1-12', async () => {
      const errors = await runValidation(monthlyQueryRules, {
        query: { month: '13', year: '2024' },
      });
      expectErrors(errors, ['month']);
    });

    it('should reject year outside 2020-2100', async () => {
      const errors = await runValidation(monthlyQueryRules, {
        query: { month: '6', year: '2019' },
      });
      expectErrors(errors, ['year']);
    });
  });

  describe('yearlyQueryRules', () => {
    it('should pass with valid year', async () => {
      const errors = await runValidation(yearlyQueryRules, {
        query: { year: '2024' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing year', async () => {
      const errors = await runValidation(yearlyQueryRules, { query: {} });
      expectErrors(errors, ['year']);
    });
  });

  describe('rangeQueryRules', () => {
    it('should pass with valid start and end', async () => {
      const errors = await runValidation(rangeQueryRules, {
        query: { start: '2024-01-01', end: '2024-12-31' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing start and end', async () => {
      const errors = await runValidation(rangeQueryRules, { query: {} });
      expectExactErrors(errors, ['start', 'end']);
    });
  });
});

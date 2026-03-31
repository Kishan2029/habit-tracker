import { describe, it, expect } from '@jest/globals';
import { exportRules } from '../../validators/exportValidators.js';
import { runValidation, expectErrors, expectNoErrors } from './helpers.js';

describe('Export Validators', () => {
  describe('exportRules', () => {
    it('should pass with valid YYYY-MM-DD start and end dates', async () => {
      const errors = await runValidation(exportRules, {
        query: { start: '2024-01-01', end: '2024-12-31' },
      });
      expectNoErrors(errors);
    });

    it('should reject missing start and end', async () => {
      const errors = await runValidation(exportRules, { query: {} });
      expectErrors(errors, ['start', 'end']);
    });

    it('should reject invalid date formats', async () => {
      const errors = await runValidation(exportRules, {
        query: { start: '01-01-2024', end: '2024/12/31' },
      });
      expectErrors(errors, ['start', 'end']);
    });
  });
});

import { describe, it, expect } from '@jest/globals';
import { exportRules } from '../../validators/exportValidators.js';

describe('Export Validators', () => {
  describe('exportRules', () => {
    it('should have 2 validation rules (start and end)', () => {
      expect(exportRules).toHaveLength(2);
    });

    it('should export an array of middleware', () => {
      exportRules.forEach((rule) => {
        expect(rule).toBeDefined();
      });
    });
  });
});

import { validationResult } from 'express-validator';

/**
 * Run an array of express-validator rules against a mock request
 * and return the validation errors.
 */
export async function runValidation(rules, { body = {}, query = {}, params = {} } = {}) {
  const req = { body, query, params };
  const res = {};
  for (const rule of rules) {
    await rule.run(req);
  }
  return validationResult(req).array();
}

export function expectErrors(errors, fields) {
  const errorPaths = errors.map((e) => e.path);
  for (const field of fields) {
    expect(errorPaths).toContain(field);
  }
}

export function expectNoErrors(errors) {
  expect(errors).toHaveLength(0);
}

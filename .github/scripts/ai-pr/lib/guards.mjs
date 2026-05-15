/**
 * Guards — forbidden path checks, pre-commit validation, and path rule matching.
 */
import { execSync } from 'child_process';
import { minimatch } from 'minimatch';

/**
 * Returns any files in `changedFiles` that match a forbidden pattern.
 * @param {string[]} changedFiles
 * @param {string[]} forbiddenPatterns - glob patterns
 * @returns {string[]} blocked files
 */
export function checkForbiddenPaths(changedFiles, forbiddenPatterns) {
  return changedFiles.filter((file) =>
    forbiddenPatterns.some((pattern) => minimatch(file, pattern, { dot: true }))
  );
}

/**
 * Run each pre-commit check in sequence.
 * Returns results array — stops at first failure and marks remainder as skipped.
 *
 * @param {Array<{id: string, run: string}>} checks
 * @returns {Array<{id, passed, output}>}
 */
export function runPreCommitChecks(checks) {
  const results = [];
  let failed = false;

  for (const check of checks) {
    if (failed) {
      results.push({ id: check.id, passed: null, output: 'skipped' });
      continue;
    }

    console.log(`\n▶ Running pre-commit check: ${check.id}`);
    console.log(`  $ ${check.run}`);

    try {
      const output = execSync(check.run, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 2 * 1024 * 1024,
      });
      console.log(`  ✓ ${check.id} passed`);
      results.push({ id: check.id, passed: true, output: output.slice(0, 3000) });
    } catch (err) {
      const output = ((err.stdout || '') + (err.stderr || '')).slice(0, 3000);
      console.error(`  ✗ ${check.id} failed:\n${output}`);
      results.push({ id: check.id, passed: false, output });
      failed = true;
    }
  }

  return results;
}

/**
 * Filter path rules to only those whose pattern matches at least one changed file.
 * Moved here from agents/claude.mjs so all adapters can use it without importing
 * from a provider-specific module.
 *
 * @param {Array<{pattern: string, rulesText: string}>} pathRules
 * @param {string[]} changedFiles
 * @returns {Array<{pattern, rulesText}>}
 */
export function matchPathRules(pathRules, changedFiles) {
  return pathRules.filter((rule) =>
    changedFiles.some((file) => minimatch(file, rule.pattern, { matchBase: false }))
  );
}

/** Format pre-commit results for display in a PR comment. */
export function formatPreCommitResults(results) {
  return results
    .map((r) => {
      if (r.passed === null) return `- ⏭ \`${r.id}\` — skipped`;
      if (r.passed) return `- ✅ \`${r.id}\` — passed`;
      return `- ❌ \`${r.id}\` — failed\n\`\`\`\n${r.output}\n\`\`\``;
    })
    .join('\n');
}

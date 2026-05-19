/**
 * Config loader — reads .github/ai-pr/config.yml and resolves all
 * referenced guidelines/path-rule markdown files.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function repoPath(...parts) {
  return resolve(REPO_ROOT, ...parts);
}

function readMarkdown(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8');
}

export function loadConfig() {
  const configPath = repoPath('.github/ai-pr/config.yml');
  const raw = yaml.load(readFileSync(configPath, 'utf8'));

  // Resolve reviewer guidelines + path rules
  const reviewer = {
    ...raw.reviewer,
    guidelinesText: readMarkdown(raw.reviewer.guidelines),
    pathRules: (raw.reviewer.path_rules || []).map((r) => ({
      pattern: r.pattern,
      rulesText: readMarkdown(r.rules),
    })),
  };

  // Resolve resolver guidelines
  const resolver = {
    ...raw.resolver,
    guidelinesText: readMarkdown(raw.resolver.guidelines),
  };

  return {
    reviewer,
    resolver,
    merger: raw.merger,
  };
}

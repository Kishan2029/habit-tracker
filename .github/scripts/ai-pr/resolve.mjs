#!/usr/bin/env node
/**
 * Stage 2 — Resolver
 * Reads review comments, calls the AI agent to fix them, validates with
 * pre-commit checks, then commits and pushes back to the PR branch.
 *
 * Required env:
 *   GITHUB_TOKEN        - for reading PR data
 *   AI_PR_PAT           - Personal Access Token with repo scope (for push)
 *   ANTHROPIC_API_KEY   - (if agent=claude)
 *   PR_NUMBER
 *   REPO                - owner/repo
 *   HEAD_REF            - PR branch name
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { resolve as resolvePath, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir, homedir } from 'os';
import { loadConfig } from './lib/config.mjs';
import {
  getPRInfo,
  getLatestBotReview,
  addLabel,
  removeLabel,
  getLabels,
  postComment,
} from './lib/github.mjs';
import { checkForbiddenPaths, runPreCommitChecks, formatPreCommitResults } from './lib/guards.mjs';
import * as claudeAgent from './agents/claude.mjs';
import * as codexAgent from './agents/codex.mjs';
import * as geminiAgent from './agents/gemini.mjs';

const PR_NUMBER = process.env.PR_NUMBER;
const HEAD_REF = process.env.HEAD_REF;
const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY;
const REPO_ROOT = resolvePath(fileURLToPath(import.meta.url), '../../../../..');
const MAX_PRE_COMMIT_RETRIES = 2;

function getAgent(name) {
  switch (name) {
    case 'claude': return claudeAgent;
    case 'codex':  return codexAgent;
    case 'gemini': return geminiAgent;
    default: throw new Error(`Unknown agent: ${name}`);
  }
}

// ─── Iteration tracking ───────────────────────────────────────────────────────

async function getIterationCount(prNumber, prefix) {
  const labels = await getLabels(prNumber);
  const label = labels.find((l) => l.startsWith(prefix));
  return label ? parseInt(label.slice(prefix.length), 10) : 0;
}

async function setIterationCount(prNumber, prefix, count) {
  const labels = await getLabels(prNumber);
  // Remove all previous iteration labels
  for (const l of labels.filter((l) => l.startsWith(prefix))) {
    await removeLabel(prNumber, l);
  }
  await addLabel(prNumber, `${prefix}${count}`);
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function readRepoFile(relativePath) {
  const fullPath = resolvePath(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf8');
}

function writeRepoFile(relativePath, content) {
  const fullPath = resolvePath(REPO_ROOT, relativePath);
  writeFileSync(fullPath, content, 'utf8');
}

function collectCommentedFiles(comments) {
  return [...new Set(comments.map((c) => c.path))];
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function gitSetup() {
  const pat = process.env.AI_PR_PAT;
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
  execSync(`git config user.name "github-actions[bot]"`);
  // Write credentials to ~/.git-credentials so the PAT never touches the shell
  // (avoids both ps-aux exposure and shell-injection via a malformed PAT value).
  execSync(`git config credential.helper store`);
  writeFileSync(
    join(homedir(), '.git-credentials'),
    `https://x-access-token:${pat}@github.com\n`,
    { flag: 'a', mode: 0o600 },
  );
  execSync(`git remote set-url origin https://github.com/${REPO}.git`);
}

function gitCommitAndPush(changedFiles, message) {
  for (const file of changedFiles) {
    const fullPath = resolvePath(REPO_ROOT, file);
    execSync(`git add "${fullPath}"`);
  }
  // Write commit message to a temp file to avoid shell injection via AI-generated text.
  const msgFile = join(tmpdir(), `ai-pr-commit-${Date.now()}.txt`);
  try {
    writeFileSync(msgFile, message, 'utf8');
    execSync(`git commit -F "${msgFile}"`);
  } finally {
    try { unlinkSync(msgFile); } catch { /* ignore */ }
  }
  execSync(`git push origin ${HEAD_REF}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== AI PR Resolver — PR #${PR_NUMBER} ===\n`);

  const config = loadConfig();
  const { resolver } = config;
  const agent = getAgent(resolver.agent);

  // ── Iteration guard ──
  const iteration = await getIterationCount(PR_NUMBER, resolver.iteration_label_prefix);
  console.log(`Iteration: ${iteration + 1} / ${resolver.max_iterations}`);

  if (iteration >= resolver.max_iterations) {
    console.log(`Max iterations (${resolver.max_iterations}) reached — handing off to human.`);
    await addLabel(PR_NUMBER, resolver.overflow_label);
    await postComment(
      PR_NUMBER,
      `🤖 The AI resolver has made **${iteration}** attempts and has not fully addressed all review comments.\n\nLabelled \`${resolver.overflow_label}\` — please review manually.`,
    );
    process.exit(0);
  }

  // ── Fetch review ──
  const botReview = await getLatestBotReview(PR_NUMBER);
  if (!botReview) {
    console.log('No REQUEST_CHANGES review from bot found — nothing to resolve.');
    process.exit(0);
  }

  const { review, comments } = botReview;
  console.log(`Review body length: ${review.body.length} chars`);
  console.log(`Inline comments: ${comments.length}`);

  // ── Read commented files ──
  const commentedFiles = collectCommentedFiles(comments);
  const fileContents = {};
  for (const file of commentedFiles) {
    const content = readRepoFile(file);
    if (content !== null) fileContents[file] = content;
    else console.warn(`  File not found (may have been added/deleted): ${file}`);
  }

  // ── Call agent (with pre-commit feedback loop) ──
  let changes = [];
  let explanation = '';
  let preCommitFailure = null;

  for (let attempt = 0; attempt <= MAX_PRE_COMMIT_RETRIES; attempt++) {
    if (attempt > 0) console.log(`\nPre-commit retry ${attempt}/${MAX_PRE_COMMIT_RETRIES}...`);

    const result = await agent.resolve({
      reviewBody: review.body,
      comments: comments.map((c) => ({ path: c.path, line: c.line, body: c.body })),
      fileContents,
      guidelines: resolver.guidelinesText,
      model: resolver.model,
      preCommitFailure,
    });

    explanation = result.explanation;
    changes = result.changes;

    console.log(`\nExplanation: ${explanation}`);
    console.log(`Files to change (${changes.length}): ${changes.map((c) => c.file).join(', ')}`);

    if (!changes.length) {
      console.log('Agent returned no file changes.');
      break;
    }

    // ── Forbidden path guard ──
    const blocked = checkForbiddenPaths(
      changes.map((c) => c.file),
      resolver.forbidden_paths,
    );
    if (blocked.length) {
      throw new Error(`Agent attempted to modify forbidden paths: ${blocked.join(', ')}`);
    }

    // ── Write files ──
    for (const change of changes) {
      console.log(`  Writing: ${change.file}`);
      writeRepoFile(change.file, change.content);
    }

    // ── Pre-commit checks ──
    const checkResults = runPreCommitChecks(resolver.pre_commit);
    const allPassed = checkResults.every((r) => r.passed !== false);

    if (allPassed) {
      console.log('\n✓ All pre-commit checks passed.');
      preCommitFailure = null;
      break;
    }

    const failed = checkResults.filter((r) => r.passed === false);
    preCommitFailure = failed.map((r) => `[${r.id}]\n${r.output}`).join('\n\n');

    if (attempt === MAX_PRE_COMMIT_RETRIES) {
      // Out of retries — commit what we have but note the failure
      console.error('\nPre-commit checks still failing after max retries. Committing with failure note.');
      await postComment(
        PR_NUMBER,
        `⚠️ AI Resolver attempt ${iteration + 1}: applied changes but pre-commit checks are still failing:\n\n${formatPreCommitResults(checkResults)}\n\nManual intervention may be needed.`,
      );
    }
  }

  // ── Commit and push ──
  if (changes.length) {
    gitSetup();

    const commitMsg = `fix: AI resolver — attempt ${iteration + 1}\n\n${explanation}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`;
    gitCommitAndPush(changes.map((c) => c.file), commitMsg);

    console.log(`\n✓ Pushed changes to ${HEAD_REF}`);
  } else {
    console.log('No changes to commit.');
  }

  // ── Update iteration counter ──
  await setIterationCount(PR_NUMBER, resolver.iteration_label_prefix, iteration + 1);

  console.log(`\n✓ Resolver complete (iteration ${iteration + 1})`);
}

main().catch((err) => {
  console.error('Resolver failed:', err);
  process.exit(1);
});

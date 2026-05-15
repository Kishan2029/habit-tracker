#!/usr/bin/env node
/**
 * Stage 1 — Reviewer
 * Reads the PR diff, calls the configured AI agent, and posts a GitHub Review.
 *
 * Required env:
 *   GITHUB_TOKEN        - for posting the review
 *   ANTHROPIC_API_KEY   - (if agent=claude)
 *   PR_NUMBER
 *   REPO                - owner/repo
 */
import { loadConfig } from './lib/config.mjs';
import { getPRInfo, getPRDiff, postReview } from './lib/github.mjs';
import * as claudeAgent from './agents/claude.mjs';
import * as codexAgent from './agents/codex.mjs';
import * as geminiAgent from './agents/gemini.mjs';

const PR_NUMBER = process.env.PR_NUMBER;

function getAgent(name) {
  switch (name) {
    case 'claude': return claudeAgent;
    case 'codex':  return codexAgent;
    case 'gemini': return geminiAgent;
    default: throw new Error(`Unknown agent: ${name}`);
  }
}

/** Extract changed file paths from a unified diff string. */
function extractChangedFiles(diff) {
  const files = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      files.push(line.slice(6));
    }
  }
  return [...new Set(files)];
}

/** Map internal verdict to GitHub review event. */
function toGitHubEvent(verdict, severityThreshold) {
  if (verdict === 'APPROVE') return 'APPROVE';
  if (verdict === 'REQUEST_CHANGES') return 'REQUEST_CHANGES';
  return 'COMMENT';
}

async function main() {
  console.log(`=== AI PR Reviewer — PR #${PR_NUMBER} ===\n`);

  const config = loadConfig();
  const { reviewer } = config;
  const agent = getAgent(reviewer.agent);

  // Fetch PR data
  const prInfo = await getPRInfo(PR_NUMBER);
  const diff = getPRDiff(PR_NUMBER);
  const changedFiles = extractChangedFiles(diff);

  console.log(`Changed files (${changedFiles.length}): ${changedFiles.join(', ')}`);

  // Match path rules to this diff
  const applicablePathRules = claudeAgent.matchPathRules(reviewer.pathRules, changedFiles);
  console.log(`Applicable path rules: ${applicablePathRules.map((r) => r.pattern).join(', ') || 'none'}`);

  // Call agent
  const result = await agent.review({
    diff,
    prInfo: {
      number: prInfo.number,
      title: prInfo.title,
      body: prInfo.body,
      author: prInfo.user,
    },
    guidelines: reviewer.guidelinesText,
    pathRules: applicablePathRules,
    model: reviewer.model,
  });

  console.log(`\nVerdict: ${result.verdict}`);
  console.log(`Summary: ${result.summary}`);
  console.log(`Inline comments: ${result.inlineComments.length}`);

  // Post review
  const event = toGitHubEvent(result.verdict, reviewer.severity_threshold);
  const runUrl = `https://github.com/${process.env.REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const fullBody = `## AI Code Review\n\n${result.body}\n\n---\n*Reviewed by ${reviewer.agent} (${reviewer.model}) · [View run](${runUrl})*`;

  await postReview(
    PR_NUMBER,
    prInfo.head.sha,
    event,
    fullBody,
    result.inlineComments,
  );

  console.log(`\n✓ Review posted (${event})`);
}

main().catch((err) => {
  console.error('Reviewer failed:', err);
  process.exit(1);
});

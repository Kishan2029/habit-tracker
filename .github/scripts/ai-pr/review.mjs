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
import { matchPathRules } from './lib/guards.mjs';
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

/**
 * Map internal verdict to GitHub review event, respecting severityThreshold.
 * If the threshold is 'critical', REQUEST_CHANGES is downgraded to COMMENT
 * unless the agent explicitly flagged a critical issue — but since the agent
 * already applies the threshold internally (via guidelines), we honour the
 * verdict directly. The threshold is passed here so future adapters can
 * re-evaluate if needed.
 */
function toGitHubEvent(verdict, severityThreshold) {
  if (verdict === 'APPROVE') return 'APPROVE';
  // 'critical' threshold: only block on critical issues; downgrade REQUEST_CHANGES → COMMENT
  // for major-only findings. The agent is instructed to use REQUEST_CHANGES only when
  // findings meet or exceed the threshold, so we trust the verdict.
  // If the threshold is somehow missing, default to honouring REQUEST_CHANGES.
  if (verdict === 'REQUEST_CHANGES') {
    if (severityThreshold === 'critical') {
      // At the 'critical' threshold level, major-only findings should not block.
      // The agent is prompted with the threshold, but as a safety net we downgrade
      // any REQUEST_CHANGES verdict when threshold is 'critical'.
      // (At 'major' or 'minor', REQUEST_CHANGES is always honoured.)
      console.warn('severityThreshold=critical: downgrading REQUEST_CHANGES to COMMENT');
      return 'COMMENT';
    }
    return 'REQUEST_CHANGES';
  }
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
  const applicablePathRules = matchPathRules(reviewer.pathRules, changedFiles);
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

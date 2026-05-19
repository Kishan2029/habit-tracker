#!/usr/bin/env node
/**
 * Stage 3 — Merger
 * Checks configured gates (CI green, AI approved, optional human approved)
 * and merges the PR if all pass.
 *
 * Required env:
 *   GITHUB_TOKEN  - must have PR merge permission
 *   PR_NUMBER
 *   REPO          - owner/repo
 */
import { loadConfig } from './lib/config.mjs';
import { getPRInfo, getReviews, isCIGreen, mergePR, postComment } from './lib/github.mjs';

const PR_NUMBER = process.env.PR_NUMBER;

async function main() {
  console.log(`=== AI PR Merger — PR #${PR_NUMBER} ===\n`);

  const config = loadConfig();
  const { merger } = config;

  const prInfo = await getPRInfo(PR_NUMBER);
  console.log(`PR: "${prInfo.title}" — ${prInfo.html_url}`);
  console.log(`Head: ${prInfo.head.sha}`);

  const gates = merger.gates;
  const failures = [];

  // ── Gate: CI green ──
  if (gates.ci_green) {
    const green = await isCIGreen(PR_NUMBER);
    console.log(`CI green: ${green}`);
    if (!green) failures.push('CI checks are not all passing');
  }

  // ── Gate: AI approved ──
  if (gates.ai_approved) {
    const reviews = await getReviews(PR_NUMBER);
    const botApproval = reviews.find(
      (r) => r.user.login === 'github-actions[bot]' && r.state === 'APPROVED',
    );
    const approved = !!botApproval;
    console.log(`AI approved: ${approved}`);
    if (!approved) failures.push('No APPROVE review from AI bot');
  }

  // ── Gate: human approved ──
  if (gates.human_approved) {
    const reviews = await getReviews(PR_NUMBER);
    const humanApproval = reviews.find(
      (r) => r.user.login !== 'github-actions[bot]' && r.state === 'APPROVED',
    );
    const approved = !!humanApproval;
    console.log(`Human approved: ${approved}`);
    if (!approved) failures.push('No human APPROVE review');
  }

  // ── Evaluate ──
  if (failures.length) {
    console.log(`\n✗ Merge blocked:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    await postComment(
      PR_NUMBER,
      `🚦 **Auto-merge blocked** — the following gates did not pass:\n\n${failures.map((f) => `- ${f}`).join('\n')}\n\nResolve these and the merge will proceed automatically.`,
    );
    process.exit(0);
  }

  // ── Merge ──
  console.log(`\nAll gates passed. Merging with strategy: ${merger.strategy}`);
  mergePR(PR_NUMBER, merger.strategy);
  console.log(`\n✓ PR #${PR_NUMBER} merged (${merger.strategy})`);
}

main().catch((err) => {
  console.error('Merger failed:', err);
  process.exit(1);
});

#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PR_NUMBER = process.env.PR_NUMBER;

// Get PR diff and metadata
const diff = execSync(`gh pr diff ${PR_NUMBER}`).toString();
const prInfo = JSON.parse(execSync(`gh pr view ${PR_NUMBER} --json title,body,author`).toString());

// Truncate large diffs to stay within token budget
const MAX_DIFF_CHARS = 80_000;
const truncatedDiff = diff.length > MAX_DIFF_CHARS
  ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n[diff truncated — showing first 80k chars]'
  : diff;

const systemPrompt = `You are an expert code reviewer for a full-stack habit-tracking app.

Stack: React 19 + Vite + Tailwind v4 (frontend), Express 5 + MongoDB (backend), Node 18+.

Key conventions to enforce:
- ES Modules only (import/export). Relative server imports must include .js extension.
- No TypeScript. Pure JavaScript + JSX only.
- API response shape: { success: true/false, message, data } or { success: false, errors }
- Business logic lives in services, not controllers. Never touch Mongoose models from controllers.
- Server errors use AppError + catchAsync — never raw try/catch in controllers.
- Dates as YYYY-MM-DD strings in local timezone. Never UTC toISOString() at API boundaries.
- JWT bearer auth. Token in localStorage on client; server reads Authorization header.
- Use sendSuccess/sendError from responseFormatter.js, never raw res.json().
- New server features: model → validator → service → controller → route → register in routes/index.js → Swagger annotation → test.
- New frontend features: api/*.js module → component under components/<domain>/ → route in App.jsx if it's a page.
- Tests required for new service methods. Coverage thresholds must stay green.`;

const userMessage = `Review this pull request and give actionable feedback.

**PR #${PR_NUMBER}: ${prInfo.title}**
${prInfo.body ? `\n**Description:**\n${prInfo.body}\n` : ''}
**Author:** ${prInfo.author.login}

**Diff:**
\`\`\`diff
${truncatedDiff}
\`\`\`

Structure your review as:

## Summary
What this PR does in 2-3 sentences.

## Issues
List bugs, security problems, broken conventions, or missing tests. For each: cite the file and line, explain the problem, suggest the fix. If none, say "No issues found."

## Suggestions
Optional improvements worth considering (non-blocking).

## Verdict
One of: ✅ **APPROVE** / ⚠️ **REQUEST CHANGES** / 💬 **COMMENT**
Followed by one sentence explaining why.`;

console.log(`Reviewing PR #${PR_NUMBER}: ${prInfo.title}`);

const stream = client.messages.stream({
  model: 'claude-opus-4-7',
  max_tokens: 4096,
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: userMessage }],
});

// Stream progress to Actions log
stream.on('text', (delta) => process.stdout.write(delta));

const message = await stream.finalMessage();
const review = message.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('');

console.log(`\n\nTokens used — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

// Write comment body to a temp file to avoid shell-escaping issues
const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const commentBody = `## Claude Code Review\n\n${review}\n\n---\n*Reviewed by [Claude Opus 4.7](https://claude.ai) · [View workflow run](${runUrl})*`;
const tmpFile = join(tmpdir(), `pr-review-${PR_NUMBER}.md`);

try {
  writeFileSync(tmpFile, commentBody);
  execSync(`gh pr comment ${PR_NUMBER} --body-file "${tmpFile}"`);
  console.log('Review posted successfully.');
} finally {
  try { unlinkSync(tmpFile); } catch {}
}

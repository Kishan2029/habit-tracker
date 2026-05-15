/**
 * Claude agent adapter.
 * Implements review() and resolve() using the Anthropic API.
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_DIFF_CHARS = 80_000;
const MAX_FILE_CHARS = 30_000;

// ─── Review ──────────────────────────────────────────────────────────────────

/**
 * Review a PR diff.
 *
 * @param {object} params
 * @param {string} params.diff
 * @param {object} params.prInfo      - { number, title, body, author }
 * @param {string} params.guidelines  - review-guidelines.md content
 * @param {Array}  params.pathRules   - [{pattern, rulesText}] applicable rules
 * @param {string} params.model
 *
 * @returns {{ verdict, summary, body, inlineComments }}
 */
export async function review({ diff, prInfo, guidelines, pathRules, model }) {
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n[diff truncated — first 80k chars shown]'
      : diff;

  const pathRulesSection = pathRules.length
    ? '\n\n## Path-specific rules\n\n' + pathRules.map((r) => `### ${r.pattern}\n${r.rulesText}`).join('\n\n')
    : '';

  const systemPrompt = guidelines + pathRulesSection;

  const userMessage = `Review this pull request and return a structured JSON response.

**PR #${prInfo.number}: ${prInfo.title}**
${prInfo.body ? `\n**Description:**\n${prInfo.body}\n` : ''}
**Author:** ${prInfo.author?.login ?? 'unknown'}

**Diff:**
\`\`\`diff
${truncatedDiff}
\`\`\`

Return ONLY a JSON code block (no other text) with this shape:

\`\`\`json
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "summary": "2-3 sentence summary of what this PR does",
  "body": "Full markdown review body with ## Issues and ## Suggestions sections",
  "inline_comments": [
    { "path": "relative/file/path.js", "line": 42, "body": "comment text" }
  ]
}
\`\`\`

- Use REQUEST_CHANGES only for MAJOR or CRITICAL issues.
- inline_comments should cite specific lines for the most important findings. Line numbers must be from the NEW version of the file.
- If no issues, set inline_comments to [].`;

  console.log(`Calling Claude ${model} for review...`);
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  console.log(`Tokens — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

  const raw = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseReviewResponse(raw);
}

function parseReviewResponse(raw) {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error('Claude did not return a JSON code block in review response');

  const parsed = JSON.parse(match[1]);
  return {
    verdict: parsed.verdict,
    summary: parsed.summary,
    body: parsed.body,
    inlineComments: parsed.inline_comments || [],
  };
}

// ─── Resolve ─────────────────────────────────────────────────────────────────

/**
 * Resolve review comments by returning corrected file contents.
 *
 * @param {object} params
 * @param {string}  params.reviewBody       - overall review text
 * @param {Array}   params.comments         - inline [{path, line, body}]
 * @param {object}  params.fileContents     - { 'path/to/file.js': '...content...' }
 * @param {string}  params.guidelines       - resolve-guidelines.md content
 * @param {string}  params.model
 * @param {string?} params.preCommitFailure - failure output from a previous attempt
 *
 * @returns {{ explanation, changes: [{file, content}] }}
 */
export async function resolve({
  reviewBody,
  comments,
  fileContents,
  guidelines,
  model,
  preCommitFailure = null,
}) {
  const filesSection = Object.entries(fileContents)
    .map(([path, content]) => {
      const truncated =
        content.length > MAX_FILE_CHARS
          ? content.slice(0, MAX_FILE_CHARS) + '\n// [file truncated]'
          : content;
      return `### ${path}\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .join('\n\n');

  const commentsSection = comments.length
    ? comments.map((c) => `- **${c.path}:${c.line}** — ${c.body}`).join('\n')
    : 'No inline comments.';

  const preCommitSection = preCommitFailure
    ? `\n## Pre-commit check failure\n\nYour previous changes failed validation:\n\`\`\`\n${preCommitFailure}\n\`\`\`\nFix this as well.\n`
    : '';

  const userMessage = `Address the review comments below and return corrected file content.

## Review summary

${reviewBody}

## Inline comments

${commentsSection}
${preCommitSection}
## Current file contents

${filesSection}

Return ONLY a JSON code block with this shape:

\`\`\`json
{
  "explanation": "One paragraph: what you changed and why.",
  "changes": [
    { "file": "server/src/services/habitService.js", "content": "...complete file content..." }
  ]
}
\`\`\``;

  console.log(`Calling Claude ${model} for resolve...`);
  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    system: [{ type: 'text', text: guidelines, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  console.log(`Tokens — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

  const raw = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseResolveResponse(raw);
}

function parseResolveResponse(raw) {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error('Claude did not return a JSON code block in resolve response');

  const parsed = JSON.parse(match[1]);
  return {
    explanation: parsed.explanation,
    changes: parsed.changes || [],
  };
}


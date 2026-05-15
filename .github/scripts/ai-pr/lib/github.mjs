/**
 * GitHub API utilities.
 * Uses the REST API via native fetch (Node 18+) for operations that need
 * structured data, and the `gh` CLI for simpler tasks.
 */
import { execSync } from 'child_process';

const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const API_BASE = `https://api.github.com/repos/${REPO}`;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function ghFetch(path, options = {}) {
  const url = path.startsWith('https://') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${options.method || 'GET'} ${url} → ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── PR info ──────────────────────────────────────────────────────────────────

export async function getPRInfo(prNumber) {
  return ghFetch(`/pulls/${prNumber}`);
}

export function getPRDiff(prNumber) {
  return execSync(`gh pr diff ${prNumber} --repo ${REPO}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Post a GitHub review with a verdict.
 * @param {string} prNumber
 * @param {string} commitId  - head commit SHA
 * @param {'APPROVE'|'REQUEST_CHANGES'|'COMMENT'} event
 * @param {string} body      - markdown review body
 * @param {Array}  comments  - inline comments [{path, line, body}]
 */
export async function postReview(prNumber, commitId, event, body, comments = []) {
  const payload = { commit_id: commitId, body, event, comments: [] };

  // Attempt to add inline comments; skip any that the API rejects.
  for (const c of comments) {
    payload.comments.push({
      path: c.path,
      line: c.line,
      side: 'RIGHT',
      body: c.body,
    });
  }

  try {
    return await ghFetch(`/pulls/${prNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // If inline comments caused failure, retry without them.
    if (payload.comments.length > 0) {
      console.warn('Inline comments caused review failure — retrying without them:', err.message);
      const fallbackBody = body + buildInlineCommentFallback(comments);
      return ghFetch(`/pulls/${prNumber}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ commit_id: commitId, body: fallbackBody, event, comments: [] }),
      });
    }
    throw err;
  }
}

function buildInlineCommentFallback(comments) {
  if (!comments.length) return '';
  const lines = ['\n\n---\n### Inline findings\n'];
  for (const c of comments) {
    lines.push(`**\`${c.path}\` line ${c.line}**\n${c.body}\n`);
  }
  return lines.join('\n');
}

// ─── Review comments ─────────────────────────────────────────────────────────

/** Get all inline review comments on a PR. */
export async function getReviewComments(prNumber) {
  return ghFetch(`/pulls/${prNumber}/comments`);
}

/** Get all reviews on a PR (summary + verdict, not inline). */
export async function getReviews(prNumber) {
  return ghFetch(`/pulls/${prNumber}/reviews`);
}

/**
 * Return the most recent REQUEST_CHANGES review posted by github-actions[bot],
 * plus all its inline comments.
 */
export async function getLatestBotReview(prNumber) {
  const reviews = await getReviews(prNumber);
  const botReviews = reviews
    .filter((r) => r.user.login === 'github-actions[bot]' && r.state === 'CHANGES_REQUESTED')
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  if (!botReviews.length) return null;
  const latest = botReviews[0];

  // Fetch inline comments for this specific review
  const allComments = await getReviewComments(prNumber);
  const comments = allComments.filter((c) => c.pull_request_review_id === latest.id);

  return { review: latest, comments };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export async function getLabels(prNumber) {
  const pr = await ghFetch(`/pulls/${prNumber}`);
  return pr.labels.map((l) => l.name);
}

export async function addLabel(prNumber, label) {
  // Ensure label exists first
  try {
    await ghFetch(`/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: label, color: 'ededed' }),
    });
  } catch {
    // Label already exists — fine
  }
  await ghFetch(`/issues/${prNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  });
}

export async function removeLabel(prNumber, label) {
  try {
    await ghFetch(`/issues/${prNumber}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
  } catch {
    // Label may not exist — ignore
  }
}

// ─── CI status ───────────────────────────────────────────────────────────────

/** Returns true if all required status checks on the PR head commit are passing. */
export async function isCIGreen(prNumber) {
  const pr = await getPRInfo(prNumber);
  const sha = pr.head.sha;
  const result = await ghFetch(`/commits/${sha}/check-runs`);
  const runs = result.check_runs || [];
  if (!runs.length) return false; // no checks = not green
  return runs.every((r) => r.status === 'completed' && r.conclusion === 'success');
}

// ─── Merge ───────────────────────────────────────────────────────────────────

export function mergePR(prNumber, strategy) {
  execSync(`gh pr merge ${prNumber} --${strategy} --auto --repo ${REPO}`, { stdio: 'inherit' });
}

// ─── PR comment (non-review) ─────────────────────────────────────────────────

export async function postComment(prNumber, body) {
  return ghFetch(`/issues/${prNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

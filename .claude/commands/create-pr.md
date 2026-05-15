---
description: Create a pull request from one branch to another. Title and body are auto-generated from the diff.
argument-hint: <from-branch> <to-branch>
---

The user invoked this with: `$ARGUMENTS`

Parse `$ARGUMENTS` as two whitespace-separated tokens:

- **FROM** — first token: source/head branch (the branch with the changes)
- **TO** — second token: target/base branch (where the PR merges into)

If `$ARGUMENTS` is empty, or fewer than two tokens are present, stop and ask the user for both branches. Don't guess.

Treat `FROM` and `TO` as literal git refs throughout. Auto-generate the PR title and body from the diff — do not ask the user for them.

## Steps

1. Fetch the latest refs and verify both branches exist (locally or on origin):
   - `git fetch origin "<FROM>" "<TO>"`
   - If either ref is missing, stop and report it.

2. Inspect the diff in parallel:
   - `git log "<TO>..<FROM>" --oneline` (commits that will ship)
   - `git diff "<TO>...<FROM>" --stat` (files + churn)
   - `git diff "<TO>...<FROM>"` (full diff — sample/skim if huge)

   If `git log "<TO>..<FROM>"` is empty, stop and tell the user there's nothing to PR.

3. Derive the PR title and body **from the diff**:
   - **Title** — one short imperative sentence (<70 chars) capturing the dominant change across the full commit range. Synthesize across all commits; don't just echo the latest commit subject.
   - **Body** — `## Summary` with 1–3 bullets describing what actually changed (features added, bugs fixed, refactors). Follow with a `## Test plan` checklist inferred from the touched areas (server tests if `server/` changed, client lint/build + manual UI checks if `client/` changed, etc.).

4. Push `<FROM>` to origin if it has no upstream or is ahead locally: `git push -u origin "<FROM>"`.

5. Create the PR. Always prefix the `gh` call with `unset GH_TOKEN;` — Conductor injects an invalid `GH_TOKEN` that overrides keyring auth.

```
unset GH_TOKEN; gh pr create \
  --base "<TO>" \
  --head "<FROM>" \
  --title "<derived title>" \
  --body "$(cat <<'EOF'
## Summary
<1-3 bullets derived from the diff>

## Test plan
- [ ] <checks inferred from touched files>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

6. Print the resulting PR URL.

## Rules

- Never invent a title/body — ground both in the actual diff.
- If `<TO>` is `main`, confirm with the user before opening (this repo merges `dev → main` only).
- Never use `--no-verify` or force-push.
- Do not amend existing commits.

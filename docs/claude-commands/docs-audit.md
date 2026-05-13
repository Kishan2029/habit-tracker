---
description: Audit the current branch for context-doc drift — does every code change have the matching doc update?
---

You are auditing the current branch (or working tree) for context-doc drift. The output is a punch list of doc updates that should accompany the code changes before merge.

## Steps

1. **Determine the diff scope.**
   Default: changes between `HEAD` and `origin/dev` (since this repo's feature flow is `feat/<slug>` → PR to `dev` → eventually `dev → main`; feature branches diverge from `dev`, not `main`). If the user provides arguments — `$ARGUMENTS` — treat them as a git ref to diff against. If the current branch is `dev` itself, diff against `origin/main` instead (you're auditing a release PR).

   ```bash
   git fetch origin dev main 2>/dev/null
   CURRENT=$(git rev-parse --abbrev-ref HEAD)
   if [ "$CURRENT" = "dev" ]; then
     BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)
   else
     BASE=$(git merge-base HEAD origin/dev 2>/dev/null || git merge-base HEAD dev)
   fi
   git diff --name-status "$BASE"...HEAD
   ```

2. **Categorise the changes.** Build a list of changed code files grouped by:
   - `server/src/models/*.js` — schema changes
   - `server/src/services/*.js` — business logic
   - `server/src/routes/*.js` — endpoint changes
   - `server/src/config/env.js` — env var changes
   - `server/src/middleware/*.js` — middleware changes
   - `client/src/api/*.js` — client API surface
   - `client/src/components/**/*.jsx` — UI changes
   - `package.json` (any) — dependency changes

3. **For each category, check whether the corresponding doc was updated.**

   | Code change | Required doc update |
   |-------------|---------------------|
   | New model OR fields/indexes changed in existing model | `docs/DATA_MODELS.md` |
   | New service or service with significantly new logic | Consider `server/CLAUDE.md` (only if a new pattern), and check whether `GOTCHAS.md` should mention a new trap |
   | New or modified endpoint | `@swagger` block above the route (run `/swagger-sync` to confirm) |
   | New env var in `env.js` | `docs/ARCHITECTURE.md` §11 (env table) |
   | New middleware | `server/CLAUDE.md` (middleware chain section) and `docs/ARCHITECTURE.md` §2 |
   | New top-level dependency | Consider an ADR — adding deps is a structural choice worth recording |
   | New client component domain folder | `client/CLAUDE.md` (folder layout section) |

   For each row, run a focused grep on the relevant doc to see whether it was touched in the diff. If not, flag it.

4. **Check for design choices that should have ADRs.**
   Look at the commit messages (`git log --format='%s%n%b' "$BASE"...HEAD`) and the actual code changes for words like: "instead of", "decided to", "we chose", "tradeoff", "alternative", "could have", "rejected". If any appear and there's no new file under `docs/decisions/`, flag a likely missing ADR.

5. **Check for footguns.**
   Scan the diff for fixes (commit messages with "fix", "bug", "regression"). If a non-trivial fix landed and `GOTCHAS.md` was not updated, suggest adding a one-liner.

## Reporting

Produce a punch list grouped by file:

```
docs/DATA_MODELS.md
  required: yes — server/src/models/StreakReward.js is new
  updated:  no
  → add a "StreakReward" section with fields, indexes, hooks notes

docs/ARCHITECTURE.md §11
  required: yes — server/src/config/env.js added VAPID_AUDIENCE
  updated:  no
  → add VAPID_AUDIENCE to the optional env vars table

docs/decisions/
  likely required: commit "Use per-user streak rewards instead of global leaderboard..." suggests a design choice
  found:    no new ADR file
  → consider drafting docs/decisions/NNNN-streak-reward-scope.md

GOTCHAS.md
  not required — no fix commits in diff
```

End with one of three verdicts:

- **All clear** — every required doc update is present, no suspected misses.
- **Action required** — list the missing updates. The user should not merge until they're done.
- **Borderline** — checks like "likely missing ADR" that the user should confirm but aren't automatic blockers.

Do not modify any files. This command only reports.

---
description: Diagnose and repair a bug end-to-end — reproduce → root cause → minimum fix → verify → GOTCHAS update → PR.
---

You are fixing a bug in this habit-tracker repo. Follow `BUG_FIX_FLOW.md` exactly — every phase is mandatory. Do not skip phases or reorder them.

Bug description: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user to describe the bug (what happens vs. what should happen, and how to trigger it) before proceeding.

---

## Phase 0 — Triage and branch

**Classify severity before writing any code:**

| Severity | Definition | Branch from | PR target |
|----------|-----------|-------------|-----------|
| **P0 — Production down / data loss** | Feature broken for all users in prod | `main` | `main` (back-merge to `dev` immediately after) |
| **P1 — Production degraded** | Significant breakage, no workaround | `main` | `main` (back-merge to `dev` immediately after) |
| **P2 — Dev-staging bug** | Caught on `dev` before reaching prod | `dev` | `dev` |
| **P3 — Regression / edge case** | Doesn't affect core flows | `dev` | `dev` |

State the severity classification and rationale before creating the branch.

```bash
# P2/P3 — branch from dev
git checkout dev && git pull
git checkout -b fix/<slug>

# P0/P1 hotfix — branch from main
git checkout main && git pull
git checkout -b fix/<slug>
```

Slug is short, kebab-case, descriptive — e.g. `fix/streak-freeze-future-date`, `fix/yearly-analytics-crash`.

**Never** push directly to `dev` or `main`. **Never** open a PR from a fix branch to `main` unless it's a P0/P1 hotfix.

---

## Phase 1 — Reproduce (write a failing test first)

**This is the most important step. Do not touch production code yet.**

1. **Find the relevant test file** under `server/src/__tests__/`. Every service and most controllers have one. If there's no test file, create it.

2. **Add a failing test case** that demonstrates the bug:
   - Name it `'bug: <what happens> when <condition>'`.
   - It must fail on current code and pass after the fix.
   - If it's a pure UI bug with no server logic to test, write down the exact manual reproduction steps instead.

3. **Run the test to confirm it fails:**
   ```bash
   cd server && npm test -- --testPathPattern=<testFile>
   ```

A bug you cannot reproduce reliably is a bug you cannot verify you fixed. If you can't make it fail consistently, stop and investigate why before continuing.

---

## Phase 2 — Root cause

Answer all three questions before writing any fix:

1. **Where** — which file, function, and line is the defect?
2. **Why** — what assumption in the code is violated? (Off-by-one? Timezone shift? Missing null check? Wrong cache key? Race condition?)
3. **Since when** — regression (something that worked before) or latent bug (never worked for this case)?
   ```bash
   git log --oneline -20 -- <file>
   ```

**Check `GOTCHAS.md` first** — the bug may be a known footgun with a documented fix pattern.

Common root cause categories in this codebase:

| Category | Signal | Where to look |
|----------|--------|---------------|
| Date/timezone | Wrong date for users not in UTC | `dateHelpers.js`, `dateUtils.js`, `HabitLog.date` handling |
| Cache staleness | Stale read after write | `_invalidateCache` call sites; both log and habit write paths |
| Auth token | Stale token accepted after password change | `user.passwordChangedAt`, `authenticate` middleware |
| Mongoose `select: false` | Field missing from query result | Fields with `select: false` need `.select('+field')` |
| Aggregation pipeline | Wrong `$match` / `$group` / `$sort` | `logService` range queries, yearly/monthly aggregations |
| ESM import | `require()` used, or missing `.js` extension | Server relative imports — must end in `.js` |
| Validator ordering | Logic runs before validation | Route file — order must be `rules → validate → controller` |
| Service worker | Double SW registration | See GOTCHAS.md § Service worker |

Write out the root cause in a single paragraph before proceeding to the fix.

---

## Phase 3 — Fix

**Minimum effective change.** Touch as few lines as possible.

Rules:
- Fix the root cause, not the symptom.
- Do not add defensive code that papers over the bug without explaining it — it makes the next bug harder to find.
- If the fix requires a new helper or util, add it, but don't refactor existing code in the same commit.
- If the fix reveals a related bug, note it in `docs/FEATURE_IDEAS.md` or open a separate issue — **do not fix it inline** unless it's trivially coupled.
- If the fix feels large (>30 lines), you've likely found a structural problem — ship the minimal fix, then open a separate refactor.

After fixing, re-run the failing test from Phase 1. It must now pass:

```bash
cd server && npm test -- --testPathPattern=<testFile>
```

---

## Phase 4 — Verify

Run the full gate. A fix that breaks something else is not a fix.

1. `/check` — server tests + client lint + client build. All must be green.
2. `/cover` — run only if you changed code covered by strict thresholds in `server/jest.config.js`.
3. `/swagger-sync` — run only if you changed an endpoint's request or response shape.

Do not open a PR with any of these failing.

---

## Phase 5 — Context update (mandatory — do NOT skip)

Bug fixes reveal things that weren't documented. Answer each question and update accordingly — in this same response, not "later":

| Question | If yes, update |
|----------|----------------|
| Is this a footgun other developers will hit? | `GOTCHAS.md` — one terse bullet. Pattern: *"Never do X — it causes Y. Do Z instead."* |
| Did the bug come from a misunderstanding of a convention? | The relevant `CLAUDE.md` (root / `client/` / `server/`) — clarify the convention |
| Did the fix change a Mongoose schema or index? | `docs/DATA_MODELS.md` |
| Did the fix reveal a non-obvious design decision? | `docs/decisions/NNNN-<slug>.md` — write the ADR if missing |
| Did the fix change an endpoint's shape? | The `@swagger` JSDoc above the route |
| Did you add or change an env var? | `docs/ARCHITECTURE.md` §11 table AND `server/src/config/env.js` |

**`GOTCHAS.md` is the highest-value update for a bug fix.** If you hit it, someone else will too. Write it down.

---

## Phase 6 — PR

### Title format
`Fix <what was broken> (<where>)` — e.g. `Fix streak freeze accepting future dates (streakFreezeService)`

### Body must include

- **Root cause** — one paragraph: what was wrong and why
- **Fix** — what changed and why it's the right fix (not just what lines changed)
- **Regression test** — confirm the failing test from Phase 1 is included and now passes
- **Severity** — P0/P1/P2/P3 and the one-sentence rationale

Target `dev` for P2/P3. Target `main` for P0/P1, then immediately open a back-merge PR from `main` → `dev`.

### After merge

- **P0/P1:** Monitor production logs for 30 minutes. If the fix introduced a regression, branch from `main`, fix, PR to `main`, back-merge to `dev`.
- **P2/P3:** Watch CI on `dev`. If the fix causes a flaky test, address it before the `dev → main` release PR.

---

## Reporting

When done, post a summary that includes:

1. **Severity** — P0/P1/P2/P3 and rationale.
2. **Root cause** — one paragraph (where, why, since when).
3. **Files changed** — full paths, what changed in each.
4. **Failing test** — name and file; confirm it now passes.
5. **Phase 4 gate results** — `/check` output (pass/fail), `/cover` and `/swagger-sync` if applicable.
6. **Phase 5 updates** — one-line verdict for each checklist question (yes/no, what was updated), even the "no" ones.

**Never silently skip a phase.** If a phase doesn't apply, say why.

# Bug Fix Flow

The canonical recipe for fixing a bug in this repo. Mirrors `FEATURE_FLOW.md` but scoped to diagnosis and repair rather than scaffolding. Use `/fix-bug <description>` to drive this flow with Claude.

---

## Triage first — classify before branching

Not all bugs have the same urgency or branching path. Classify before writing any code.

| Severity | Definition | Branch from | PR target |
|----------|-----------|-------------|-----------|
| **P0 — Production down / data loss** | Feature broken for all users in production | `main` | `main` (then back-merge to `dev`) |
| **P1 — Production degraded** | Significant breakage with no workaround | `main` | `main` (then back-merge to `dev`) |
| **P2 — Dev-staging bug** | Caught on `dev` before reaching production | `dev` | `dev` |
| **P3 — Regression / edge case** | Doesn't affect core flows; caught in testing or reported rarely | `dev` | `dev` |

**Hotfix rule (P0/P1):** Branch from `main`, fix, PR to `main`, merge, then **immediately** open a back-merge PR from `main` into `dev`. Never skip the back-merge — divergent branches are how three-way conflicts happen. See `FEATURE_FLOW.md` § Hotfix exception.

---

## Phase 0 — Branch

```bash
# Regular fix (P2/P3) — branch from dev
git checkout dev && git pull
git checkout -b fix/<slug>

# Hotfix (P0/P1) — branch from main
git checkout main && git pull
git checkout -b fix/<slug>
```

Slug is short, kebab-case, descriptive: `fix/streak-freeze-future-date`, `fix/logservice-syntax-error`, `fix/yearly-analytics-crash`.

**Never** push directly to `dev` or `main`. **Never** open a PR from a fix branch to `main` unless it's a P0/P1 hotfix.

---

## Phase 1 — Reproduce (5–15 min)

**Write a failing test before touching production code.** This is the most important step.

1. **Locate the relevant test file.** Every service and most controllers have tests under `server/src/__tests__/`. Find the file closest to where the bug lives.

2. **Add a failing test case** that demonstrates the bug:
   - Name it `'bug: <what happens> when <condition>'` so it's identifiable in CI history.
   - It should fail on the current code and pass after the fix.
   - If you can't write a test (pure UI bug), document the manual reproduction steps instead.

3. **Run the test to confirm it fails:**
   ```bash
   cd server && npm test -- --testPathPattern=<testFile>
   ```
   A bug you can't reproduce reliably is a bug you can't verify you fixed.

---

## Phase 2 — Root cause (5–20 min)

Don't fix what you *think* is wrong — find what's *actually* wrong.

Answer these three questions before writing the fix:

1. **Where** — which file, function, and line is the defect?
2. **Why** — what assumption in the code is violated by the failing case? (Off-by-one? Timezone shift? Missing null check? Wrong cache key? Race condition?)
3. **Since when** — is this a regression (broke something that worked) or a latent bug (never worked for this case)? `git log --oneline -20 -- <file>` helps.

Check `GOTCHAS.md` before digging — the bug may be a known footgun with a documented fix pattern.

Common root cause categories in this codebase:

| Category | Signal | Where to look |
|----------|--------|---------------|
| Date/timezone | Wrong date for users not in UTC | `dateHelpers.js`, `dateUtils.js`, `HabitLog.date` handling |
| Cache staleness | Stale read after write | `_invalidateCache` call sites; check both log and habit write paths |
| Auth token | Stale token accepted after password change | `user.passwordChangedAt`, `authenticate` middleware |
| Mongoose `select: false` | Field missing from query | Fields with `select: false` need `.select('+field')` |
| Aggregation pipeline | Wrong `$match` / `$group` / `$sort` stage | `logService` range queries, yearly/monthly aggregations |
| ESM import | `require()` used, or missing `.js` extension | Server imports — must use `.js` extension on relative paths |
| Validator ordering | `validate` before rules, or rules missing | Route file — order must be `rules → validate → controller` |
| Service worker | Double SW registration | See GOTCHAS.md § Service worker |

---

## Phase 3 — Fix (5–30 min)

**Minimum effective change.** A bug fix should touch as few lines as possible. If the fix feels large, you've found a structural problem — separate the refactor from the fix (ship the fix first, refactor separately).

Fix rules:
- Fix the root cause, not the symptom.
- Do not add defensive code that papers over a bug without explaining it — that makes the next bug harder to find.
- If the fix requires a new helper or util, add it, but don't refactor existing code in the same commit.
- If the fix reveals a related bug, **log it in `docs/FEATURE_IDEAS.md` or open a separate issue** — do not fix it inline unless it's trivially coupled.

After fixing, run the failing test from Phase 1. It must now pass:

```bash
cd server && npm test -- --testPathPattern=<testFile>
```

---

## Phase 4 — Verify (2–5 min)

Run the full gate. A bug fix that breaks something else isn't a fix.

1. `/check` — server tests + client lint + client build. All must pass.
2. `/cover` — only if you changed code covered by strict thresholds in `server/jest.config.js`.
3. `/swagger-sync` — only if you changed an endpoint's request or response shape.

Do not open a PR with any of these failing.

---

## Phase 5 — Context update (5 min) — DO NOT SKIP

Bug fixes reveal things that weren't documented. Update before opening the PR.

| Question | If yes, update |
|----------|----------------|
| Is this a footgun other developers will hit? | `GOTCHAS.md` — one terse bullet under the right section. Use the pattern: *"Never do X — it causes Y. Do Z instead."* |
| Did the bug come from a misunderstanding of a convention? | The relevant `CLAUDE.md` (root / `client/` / `server/`) — clarify the convention |
| Did the fix change a Mongoose schema or index? | `docs/DATA_MODELS.md` |
| Did the fix reveal a non-obvious design decision? | `docs/decisions/NNNN-<slug>.md` — write the ADR if missing |
| Did the fix change an endpoint's shape? | The `@swagger` JSDoc above the route |
| Did you add or change an env var? | `docs/ARCHITECTURE.md` §11 table AND `server/src/config/env.js` |

**`GOTCHAS.md` is the highest-value update for a bug fix.** If you hit it, someone else will too. Write it down.

---

## Phase 6 — PR and merge

### PR checklist

- Title: `Fix <what was broken> (<where>)` — e.g. `Fix streak freeze accepting future dates (streakFreezeService)`
- Body must include:
  - **Root cause** — one paragraph: what was wrong and why
  - **Fix** — what changed and why it's the right fix (not just what lines changed)
  - **Regression test** — confirm the failing test from Phase 1 is included and now passes
  - **Severity** — P0/P1/P2/P3 and why

- Target `dev` for P2/P3. Target `main` for P0/P1 (then back-merge `main → dev`).

### After merge

- **P0/P1:** Monitor production logs for 30 minutes after deploy. If the fix introduced a regression, the hotfix-the-hotfix rule applies: branch from `main`, fix, PR to `main`, back-merge to `dev`.
- **P2/P3:** Watch CI on `dev`. If the fix causes a flaky test, address it before the `dev → main` release PR.

---

## Quick reference

```
Triage:    P0/P1 → branch from main   P2/P3 → branch from dev
Phase 0:   git checkout -b fix/<slug>
Phase 1:   Write failing test first
Phase 2:   Find root cause (where / why / since when)
Phase 3:   Minimum effective fix → confirm failing test now passes
Phase 4:   /check, /cover, /swagger-sync
Phase 5:   GOTCHAS.md (mandatory if it's a footgun)
Phase 6:   PR with root cause + fix + regression test + severity
```

## Pointers

- Known footguns → `GOTCHAS.md`
- Branching rules → `FEATURE_FLOW.md` § Phase 0 and § Hotfix exception
- Server conventions → `server/CLAUDE.md`
- Client conventions → `client/CLAUDE.md`
- Testing patterns → `docs/TESTING.md`
- Data models → `docs/DATA_MODELS.md`
- Past decisions → `docs/decisions/`

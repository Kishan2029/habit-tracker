# Feature Development Flow

The canonical recipe for adding a feature to this repo. Every feature passes through these phases. Phases 1, 2, and 5 are the ones people skip — they're also where features become tech debt. The slash commands and the `scaffold-habit-feature` skill automate phases 3 and 4; this doc enforces 1, 2, and 5.

---

## Phase 0 — Branch

Two long-lived branches:

| Branch | Environment |
|--------|-------------|
| `dev` | dev-staging |
| `main` | production |

All feature work branches off `dev`. PRs target `dev`. `main` is only updated by merging `dev` into it.

```bash
git checkout dev
git pull
git checkout -b feat/<slug>
```

Naming convention for branches: `feat/<slug>` for new features, `fix/<slug>` for bug fixes, `chore/<slug>` for non-feature work. Slug is short, kebab-case, descriptive — `feat/rest-day-toggle`, `fix/streak-freeze-future-date`.

**Never** push directly to `dev` or `main`. **Never** open a PR from a feature branch to `main`.

---

## Phase 1 — Frame (5–10 min)

First, **check the backlog**. `docs/FEATURE_IDEAS.md` may already have this feature with rough scope, tradeoffs, and dependencies noted. If it's there:

- Update its status to `Planned` (or `In progress` when you actually start coding).
- Lift the `Surface` and `Tradeoffs` sections into your design notes — they're a head start, not a constraint.
- If the framing has evolved since the entry was written, edit it.

If it's not there, that's fine — but consider adding it to the backlog as you frame, so the next person (or session) benefits.

Then write down three things in plain English **before opening any code**:

1. **What** the feature does — one sentence.
2. **Why** — the user problem it solves, also one sentence.
3. **Done** — what the user can do at the end that they couldn't before. One sentence.

If working with Claude, this is your first message. Claude will use `AskUserQuestion` to clarify gaps. If it doesn't ask, the frame is too vague — tighten it before continuing.

Example:
> What: Add a "rest day" mode that pauses streak counting for a habit on user-chosen days.
> Why: People want to take Sundays off without losing their streak, and StreakFreeze is too rationed for that use case.
> Done: A user can mark "Sunday" as a rest day on a habit, and the streak treats Sundays as if the habit wasn't scheduled.

---

## Phase 2 — Design (10–30 min)

Sketch three surfaces. You don't need diagrams — bullets are fine — but you need them written down so phase 5 has something to verify against.

### Data model

- New schema? Sketch fields, types, constraints, indexes. Will it become a Mongoose model or extend an existing one?
- Modified schema? List the new fields and any migration concern (e.g. backfill default for existing docs).

### API surface

- New endpoints: `METHOD /path — description`.
- Modified endpoints: list the change.
- Auth / authorization: user-scoped? Admin only? Shared-habit role gated?

### UI surface

- New pages? Where do they sit in the route tree?
- New components? Which existing `components/<domain>/` folder do they belong in?
- Existing components touched?

### Decision check (the ADR trigger)

Before moving on, ask: **"Is there a non-obvious choice here that future-me will question?"**

Examples of choices worth an ADR:
- Granularity of a new join table (one doc per pair vs embedded array)
- Push vs email vs both for a new notification
- Per-user state vs shared state
- New caching key, or change to existing cache invalidation strategy
- Choosing a new library (rare — we've avoided this so far; if you're adding one, ADR it)

If yes, **draft the ADR now**, before code. Drafting forces you to articulate the alternative; the alternative usually turns out to be simpler. Add the file as `docs/decisions/NNNN-<slug>.md` using the template in `docs/decisions/README.md`.

---

## Phase 3 — Scaffold (15–60 min)

Either:

- Invoke `/new-feature <resource>` — explicit, predictable, recommended.
- Or describe the feature naturally ("add a rest-day toggle to habits") and let the `scaffold-habit-feature` skill trigger.

Both walk the same ladder in this order:

```
model → validator → service → controller → route → Swagger
                                                ↓
                              tests (services first, then controllers)
                                                ↓
                                client API module → components → route
```

Don't skip ahead. Each layer's test depends on the previous layer existing. The skill and command both refuse to lower coverage thresholds — if the new code can't be tested to 100%, that's a signal to refactor, not to weaken the gate.

---

## Phase 4 — Verify (2–5 min)

Run, in order:

1. `/check` — server tests + client lint + client build. Stops at the first failure.
2. `/cover` — only if you touched anything covered by the strict thresholds in `server/jest.config.js`.
3. `/swagger-sync` — only if you added or changed any endpoint.

Don't open a PR with any of these failing. If `/check` is slow (>30s for server tests), that's a separate bug — see `docs/TESTING.md` § "When tests get slow."

---

## Phase 5 — Context update (5–15 min) — DO NOT SKIP

This is the phase that makes Claude useful on the *next* feature. Walk this checklist before opening the PR. Run `/docs-audit` against your branch — it surfaces what's missing.

### Six-question checklist

| Question | If yes, update |
|----------|----------------|
| Did you add a Mongoose schema or change fields/indexes? | `docs/DATA_MODELS.md` — add or update the table, indexes, and any notes about hooks / gotchas |
| Did you introduce a new pattern or convention? | Relevant `CLAUDE.md` (root for repo-wide, `client/CLAUDE.md` or `server/CLAUDE.md` for scoped) |
| Did you make a non-obvious design choice? | `docs/decisions/NNNN-<slug>.md` — should already exist from phase 2; if not, write it now |
| Did you hit a footgun or fix a subtle bug? | `GOTCHAS.md` — one terse bullet under the right section |
| Did you add or change an environment variable? | Both `docs/ARCHITECTURE.md` §11 (env table) AND `server/src/config/env.js`. Never one without the other. |
| Did you add or change an endpoint? | The `@swagger` JSDoc above the route. `/swagger-sync` flags drift. |

**No exceptions on the schema and ADR questions.** Stale `DATA_MODELS.md` and missing ADRs are the two highest-cost forms of context rot. Everything else is forgivable; those two compound.

### Self-test: would Claude do the right thing tomorrow?

Pretend it's a week from now and someone asks Claude to "add another thing like X." Read your updated docs out loud. Would Claude get it right without you in the loop? If no, you missed an update. Common misses:

- New service method that touches the cache — but `_invalidateCache` wasn't mentioned in `server/CLAUDE.md`.
- New shared-habit permission — but the role matrix in `docs/ARCHITECTURE.md` § 4 wasn't updated.
- New date-related helper — but `client/CLAUDE.md` still tells you to use the old set.

---

## Phase 6 — Merge and observe

Two-stage release.

### 6a. Feature → `dev`

1. Push the branch and open a PR against `dev`.
2. Standard PR review: at least one approval, all CI checks green, every comment resolved.
3. Squash-merge into `dev`. The dev-staging environment redeploys automatically.
4. Manually smoke-test the feature on dev-staging. Don't skip this — production deploys ride on the assumption that dev-staging is the real test.

### 6b. `dev` → `main`

Done separately, not per-feature. Cadence is up to you, but the mechanism is fixed:

1. Open a PR from `dev` into `main`. The PR title should summarise everything bundled in the release.
2. Quick review — the work has already been reviewed at the feature-PR level; this gate is for release sanity (no half-shipped work, no schema migration that hasn't run, no env var missing in production).
3. Merge `dev` into `main`. Production redeploys.

### Hotfix exception

Real production incidents can't wait for `dev` to bake. The exception:

1. Branch from `main`: `git checkout main && git pull && git checkout -b fix/<slug>`.
2. PR to `main` directly. Get the fix shipped.
3. **Immediately** open a second PR from `main` back into `dev` so the branches don't diverge. Don't leave this for "later" — divergent long-lived branches are how three-way merge conflicts happen.

### After merge

Watch for two signals over the next few days:

1. **Production errors your tests missed.** Write the test, then raise the threshold so the gap can't reopen.
2. **"Wait, how does this work?" questions** — from yourself, a teammate, or Claude in a new session. That's a context gap. Fix it immediately while it's fresh. The cost of fixing context grows superlinearly with time since the change.

---

## Quick reference

```
Phase 0: Branch          — feat/<slug> off dev (never off main)
Phase 1: Frame           — write what / why / done
Phase 2: Design          — model + API + UI + decision check (ADR if non-obvious)
Phase 3: Scaffold        — /new-feature  OR  scaffold-habit-feature skill
Phase 4: Verify          — /check, /cover, /swagger-sync
Phase 5: Context update  — six-question checklist + /docs-audit
Phase 6: Merge + observe — feature → dev → main, then watch signals
```

## Pointers

- Candidate features and backlog: `docs/FEATURE_IDEAS.md`
- Layered backend rules: `server/CLAUDE.md`
- Frontend rules: `client/CLAUDE.md`
- Data model reference: `docs/DATA_MODELS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Testing: `docs/TESTING.md`
- Past decisions: `docs/decisions/`
- Booby traps: `GOTCHAS.md`

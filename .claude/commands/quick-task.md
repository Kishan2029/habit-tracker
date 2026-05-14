---
description: Execute a small, scoped change end-to-end — UI tweak, minor backend change, or chore — without the full feature scaffold.
---

You are executing a quick task in this habit-tracker repo. Follow `QUICK_TASK_FLOW.md` — every phase is required, but each is lightweight by design.

Task description: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user to describe the task (what needs to change and where) before proceeding.

---

## Scope gate — check before touching any code

Before branching, verify this is actually a quick task. If **any** of the following is true, stop and tell the user to use a different tool:

| Signal | Correct tool |
|--------|-------------|
| Requires a new Mongoose model or collection | `/new-feature` |
| Requires a new route or controller | `/new-feature` or `/add-endpoint` |
| Touches more than 2–3 files in unrelated domains | `/new-feature` |
| Corrects wrong behavior (something broken that should work) | `/fix-bug` |
| Requires writing a failing test first to reproduce the problem | `/fix-bug` |

State which category the task falls into (UI change / minor backend / chore) before moving on.

---

## Phase 0 — Branch

```bash
git checkout dev && git pull
git checkout -b <prefix>/<slug>
```

Choose the prefix:
- `feat/` — small enhancement with visible user value
- `chore/` — housekeeping: deps, config, renaming, docs, dead code removal
- `style/` — pure cosmetic change with zero logic change

Slug: short, kebab-case — e.g. `chore/bump-mongoose`, `style/empty-state-copy`, `feat/add-color-to-export`.

---

## Phase 1 — Make the change

Make the minimal change. Guidelines by type:

### Small UI change
- Use existing `components/ui/` primitives (`Button`, `Card`, `Modal`, `LoadingSpinner`, `EmptyState`). Don't introduce a new library.
- Colors and spacing from Tailwind tokens — no inline hex values.
- Dates formatted with `utils/dateUtils.js` — never `toISOString()` at render time.
- If you touched a color or background, mentally verify both light and dark mode.

### Minor backend change
- Business logic stays in the service, never in the controller.
- New schema field: add with a sensible default so existing documents don't break. Check whether a new index is needed.
- Validator changes: keep order `rules → validate → controller`.
- Constants: `server/src/config/constants.js` is the single source of truth.

### Chore
- Dependency bump: run `npm audit` after. Note any new vulnerabilities in the PR.
- Dead code removal: confirm nothing imports it — `grep -r '<symbol>' server/src client/src`.
- Env var changes (add/rename/remove): update `docs/ARCHITECTURE.md` §11 AND `server/src/config/env.js`.

---

## Phase 2 — Verify

Run only what applies. Don't skip the gate entirely.

| What changed | Run |
|--------------|-----|
| Any server logic | `cd server && npm test` |
| Client code | `cd client && npm run lint` |
| Client build affected | `cd client && npm run build` |
| Both sides | `/check` (runs all three) |
| Coverage thresholds at risk | `/cover` |
| Endpoint shape changed | `/swagger-sync` |

Do not open a PR with failing tests, lint errors, or a broken build.

---

## Phase 3 — Context update

Answer each question. Update if triggered — in this response, not "later":

| Question | If yes, update |
|----------|----------------|
| Hit a footgun another developer will hit? | `GOTCHAS.md` — one terse bullet |
| Changed a Mongoose schema or index? | `docs/DATA_MODELS.md` |
| Added or changed an env var? | `docs/ARCHITECTURE.md` §11 AND `server/src/config/env.js` |
| Changed an endpoint's request/response shape? | The `@swagger` JSDoc above the route |

If none apply, say so explicitly — don't silently skip the check.

---

## Phase 4 — PR

### Title

- `Chore: <what>` — e.g. `Chore: bump mongoose to 8.4`
- `Style: <what>` — e.g. `Style: update empty-state copy on insights view`
- `Feat: <what>` — e.g. `Feat: add color column to CSV export`

### Body must include

- **What changed** — one or two sentences (file(s) + what specifically)
- **Why** — even for a chore; one sentence is enough
- **Verify steps** — what the reviewer should check

For any visible UI change, describe what changed in the UI (or attach a screenshot if you can).

Target branch: `dev`. Never `main`.

---

## Reporting

When done, post a summary with:

1. **Task type** — UI change / minor backend / chore
2. **Files changed** — full paths and one-line description of each change
3. **Phase 2 results** — which commands ran and whether they passed
4. **Phase 3** — one-line verdict per checklist item (yes/no + what was updated)
5. **PR** — title and link

If the task grew in scope during execution, call it out. Don't silently expand — flag it and ask whether to promote to `/new-feature`.

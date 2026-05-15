# Quick Task Flow

The canonical recipe for small, scoped changes that don't warrant the full `FEATURE_FLOW.md` scaffold. Use `/quick-task <description>` to drive this flow with Claude.

Covers three kinds of work:
- **Small UI changes** — copy tweaks, style adjustments, a small component or display change (no new API needed)
- **Minor backend changes** — adding a field, tweaking a validator or service method, adjusting a constant (existing resource, no new endpoints)
- **Chores** — dependency updates, config tweaks, renaming, docs updates, removing dead code

---

## Scope gate — check before branching

A quick task must stay small. If the answer to **any** of these is yes, stop and use the right tool instead:

| Signal | Use instead |
|--------|-------------|
| Requires a new Mongoose model or collection | `FEATURE_FLOW.md` / `/new-feature` |
| Requires a new route or controller | `FEATURE_FLOW.md` / `/new-feature` or `/add-endpoint` |
| Touches more than 2–3 files in unrelated domains | `FEATURE_FLOW.md` / `/new-feature` |
| Corrects wrong behavior (something that should work but doesn't) | `BUG_FIX_FLOW.md` / `/fix-bug` |
| Requires a failing test to be written first | `BUG_FIX_FLOW.md` / `/fix-bug` |

If the task is still in scope, proceed.

---

## Phase 0 — Branch

```bash
git checkout dev && git pull
git checkout -b <prefix>/<slug>
```

Pick the right prefix:

| Prefix | When |
|--------|------|
| `feat/` | Small enhancement that adds visible user value |
| `chore/` | Housekeeping — deps, config, renaming, docs, dead code |
| `style/` | Pure cosmetic change (copy, colour, spacing) with zero logic change |

Slug is short and kebab-case: `chore/bump-mongoose`, `style/empty-state-copy`, `feat/add-color-to-export`.

**Never** push directly to `dev` or `main`.

---

## Phase 1 — Make the change

Do the work. No special ordering — just make the minimal change.

Guidelines by task type:

### Small UI change
- Use existing `components/ui/` primitives — don't reach for a new library.
- Colors, spacing, and dark-mode variants come from Tailwind tokens, not inline hex.
- Use `utils/dateUtils.js` for any date formatting — never `toISOString()` at render time.
- Check both light and dark mode if you touched a color or background.

### Minor backend change
- Business logic stays in the service, not the controller.
- If you add a field to a Mongoose schema, add it with a sensible default (so existing documents aren't broken) and check if an index is needed.
- If you touch a validator, keep the order: `rules → validate → controller`.
- If you add or rename a constant, update `server/src/config/constants.js` and nowhere else.

### Chore
- Dependency bumps: run `npm audit` after. If new vulnerabilities appear, address them or document why they're acceptable.
- Dead code removal: confirm nothing imports the removed code (`grep -r '<symbol>' server/src client/src`).
- Config changes: if you touch an env var (add, rename, remove), update `docs/ARCHITECTURE.md` §11 table AND `server/src/config/env.js`.

---

## Phase 2 — Verify

Run only what's relevant. Don't skip the gate entirely.

| What changed | Run |
|--------------|-----|
| Any server logic | `cd server && npm test` |
| Client code | `cd client && npm run lint` |
| Client build affected | `cd client && npm run build` |
| Coverage thresholds at risk | `/cover` |
| Endpoint shape changed | `/swagger-sync` |

Shortcut for a change that touches both sides: `/check` runs everything at once.

Do not open a PR with failing tests, lint errors, or a broken build.

---

## Phase 3 — Context update

Quick tasks are small — but they still reveal things worth documenting. Answer each question:

| Question | If yes, update |
|----------|----------------|
| Hit a footgun another developer will hit? | `GOTCHAS.md` — one terse bullet |
| Changed a Mongoose schema or index? | `docs/DATA_MODELS.md` |
| Added or changed an env var? | `docs/ARCHITECTURE.md` §11 table AND `server/src/config/env.js` |
| Changed an endpoint's request/response shape? | The `@swagger` JSDoc above the route |
| Removed a dependency or added a new one? | Worth a note in the PR body — reviewers should know |

If none apply, skip. But read the list — don't assume none apply.

---

## Phase 4 — PR

### Title format

Match the prefix: `Chore: <what>`, `Style: <what>`, or `Feat: <what>` — e.g.:
- `Chore: bump mongoose to 8.4`
- `Style: update empty-state copy on insights view`
- `Feat: add color column to CSV export`

### Body

- **What changed** — one or two sentences. What file(s), what specifically.
- **Why** — even for a chore. "Fixes a deprecation warning" or "user-reported wording confusion" is enough.
- **Verify steps** — what the reviewer should check (e.g., "dark-mode screenshot attached", "run `/check`").

For a one-line chore, the body can be brief. For anything visible to users, attach a screenshot or describe what changed in the UI.

Target `dev`. Never target `main` directly.

---

## Quick reference

```
Scope gate: new model/route → /new-feature   wrong behavior → /fix-bug
Phase 0:    git checkout -b <feat|chore|style>/<slug>
Phase 1:    make the minimal change
Phase 2:    npm test / lint / build — only what's relevant; /check for both sides
Phase 3:    GOTCHAS, DATA_MODELS, env, swagger — only if triggered
Phase 4:    PR titled Chore:/Style:/Feat:, body with what+why+verify
```

## Pointers

- Full feature scaffolding → `FEATURE_FLOW.md`
- Bug diagnosis and repair → `BUG_FIX_FLOW.md`
- Adding one endpoint to an existing resource → `/add-endpoint`
- Server conventions → `server/CLAUDE.md`
- Client conventions → `client/CLAUDE.md`
- Known footguns → `GOTCHAS.md`

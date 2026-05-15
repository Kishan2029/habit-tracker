---
description: Diagnose and repair a bug end-to-end — reproduce → root cause → minimum fix → verify → GOTCHAS update → PR.
---

You are fixing a bug in this habit-tracker repo. Follow `BUG_FIX_FLOW.md` exactly — every phase is mandatory. Do not skip phases or reorder them.

Bug description: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user to describe the bug (what happens vs. what should happen, and how to trigger it) before proceeding.

---

All phases, rules, tables, and checklists are defined in `BUG_FIX_FLOW.md`. Read it now and follow it. What follows are Claude-specific execution notes to supplement that doc.

## Execution notes

**Phase 0 — Triage and branch**
State the severity classification (P0/P1/P2/P3) and rationale out loud before creating the branch. Don't proceed until you've committed to a severity.

**Phase 1 — Reproduce**
Do not touch production code before the failing test exists and fails. If the bug is pure UI with no server logic, document the exact manual reproduction steps instead.

**Phase 2 — Root cause**
Write out the root cause in a single paragraph — where, why, since when — before writing the fix. Check `GOTCHAS.md` first.

**Phase 3 — Fix**
Minimum effective change. After fixing, re-run the failing test from Phase 1 to confirm it now passes.

**Phase 4 — Verify**
Run `/check`. Run `/cover` only if you changed code under strict thresholds. Run `/swagger-sync` only if an endpoint's shape changed. Do not open a PR with any of these failing.

**Phase 5 — Context update**
Answer every checklist question in `BUG_FIX_FLOW.md` § Phase 5 — in this response, not "later". `GOTCHAS.md` is the highest-value update for a bug fix.

**Phase 6 — PR**
Title: `Fix <what was broken> (<where>)`. Body must include root cause, fix rationale, regression test confirmation, and severity. Target `dev` for P2/P3; target `main` for P0/P1 then immediately open a back-merge PR to `dev`.

## Reporting

When done, post a summary that includes:

1. **Severity** — P0/P1/P2/P3 and rationale.
2. **Root cause** — one paragraph (where, why, since when).
3. **Files changed** — full paths, what changed in each.
4. **Failing test** — name and file; confirm it now passes.
5. **Phase 4 gate results** — `/check` output (pass/fail), `/cover` and `/swagger-sync` if applicable.
6. **Phase 5 updates** — one-line verdict for each checklist question (yes/no, what was updated), even the "no" ones.

**Never silently skip a phase.** If a phase doesn't apply, say why.

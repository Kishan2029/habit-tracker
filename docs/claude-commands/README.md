# Claude slash commands

The authoritative copies of all slash commands live in `.claude/commands/` and are checked into the repo. Claude Code picks them up automatically from there — no manual copy step needed.

This `docs/claude-commands/` folder is kept as a reference index only (the `README.md` you're reading now). The individual `.md` files live in `.claude/commands/`.

## Available commands

| Command | Purpose |
|---------|---------|
| `/new-feature <resource>` | Scaffold a full-stack feature end-to-end (model → validator → service → controller → route → tests → client API). |
| `/add-endpoint <METHOD> <path> <description>` | Add one endpoint to an existing resource — much narrower than `/new-feature`. |
| `/check` | Run the full pre-commit gate: server tests, client lint, client build. |
| `/cover` | Audit server test coverage against the thresholds in `jest.config.js` and report gaps. |
| `/swagger-sync` | Audit `server/src/routes/*.js` for missing or stale `@swagger` JSDoc blocks. |
| `/docs-audit` | Audit the current branch for context-doc drift — flags missing `DATA_MODELS.md`, ADR, env, and GOTCHAS updates that the code changes warrant. Run before opening a PR. |
| `/fix-bug <description>` | Drive a bug fix end-to-end: triage → failing test → root cause → minimum fix → verify → GOTCHAS update → PR. |
| `/quick-task <description>` | Execute a small, scoped change (UI tweak, minor backend change, chore) without the full feature scaffold. |

## When to edit them

Slash commands are markdown prompts. Edit the file under `.claude/commands/` directly — that's the live copy. Don't create a duplicate here.

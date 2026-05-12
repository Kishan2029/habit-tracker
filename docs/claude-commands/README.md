# Claude slash commands — staging folder

These are slash commands that should live in `.claude/commands/`. The `.claude/` directory is protected from automated writes in some environments, so they're staged here. To activate them:

```bash
mkdir -p .claude/commands
cp docs/claude-commands/*.md .claude/commands/
# do NOT copy this README
rm -f .claude/commands/README.md
```

After that, Claude Code picks them up automatically. Invoke with `/new-feature streakReward`, `/check`, etc.

## Available commands

| Command | Purpose |
|---------|---------|
| `/new-feature <resource>` | Scaffold a full-stack feature end-to-end (model → validator → service → controller → route → tests → client API). |
| `/add-endpoint <METHOD> <path> <description>` | Add one endpoint to an existing resource — much narrower than `/new-feature`. |
| `/check` | Run the full pre-commit gate: server tests, client lint, client build. |
| `/cover` | Audit server test coverage against the thresholds in `jest.config.js` and report gaps. |
| `/swagger-sync` | Audit `server/src/routes/*.js` for missing or stale `@swagger` JSDoc blocks. |

## When to edit them

Slash commands are markdown prompts. If Claude is doing something slightly off when you run one, edit the corresponding `.md` file — that's faster than re-explaining every session.

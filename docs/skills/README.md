# Claude skills — staging folder

These skills should live under `.claude/skills/`. The `.claude/` directory is protected from automated writes in some environments, so they're staged here. To activate:

```bash
mkdir -p .claude/skills
cp -R docs/skills/scaffold-habit-feature .claude/skills/
# do not copy this README
```

After that, Claude picks them up automatically. They trigger based on the description in the front matter — when the user's request matches what the skill is for, Claude loads `SKILL.md` and follows it.

## Available skills

| Skill | What it does |
|-------|--------------|
| `scaffold-habit-feature` | End-to-end scaffolding of a new feature: model → validator → service → controller → route → Swagger → tests → client API → components. |

## Skills vs slash commands

| | Slash command | Skill |
|---|---|---|
| Invocation | Explicit: `/new-feature` | Implicit: triggers on a matching request |
| Visibility | User sees the slash in their input | User just asks naturally |
| Best for | Tools you run on demand (`/check`, `/cover`) | Workflows you want Claude to recognize automatically |
| File | `.claude/commands/<name>.md` | `.claude/skills/<name>/SKILL.md` (+ optional helper scripts) |

The `/new-feature` slash command and the `scaffold-habit-feature` skill overlap intentionally. Use the slash command when you want to invoke deliberately; the skill is the safety net for when you forget and say "add a streak reward feature" instead.

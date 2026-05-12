---
description: Run the full pre-commit gate — server tests, client lint, client build. Report failures concisely.
---

Run the project's full pre-commit gate and report results.

## Steps

Run these in order. Stop at the first failure and report it; don't continue to later steps.

1. **Server tests** — `cd server && npm test`
2. **Client lint** — `cd client && npm run lint`
3. **Client build** — `cd client && npm run build`

## Reporting

For each step, report only:
- Pass / fail
- For failures: the file/test name and the first 5–10 lines of the actual error (not the full stack trace unless asked)

If everything passes, just say "All green" and list the three checks with checkmarks.

If something fails, do NOT attempt to fix it unless the user asks. Just report what failed and where.

Skip slash command setup / environment install steps — assume `npm install` has already been run at the repo root.

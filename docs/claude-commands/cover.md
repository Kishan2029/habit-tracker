---
description: Run server test coverage and report files below threshold, with a plan to fix them.
---

Audit server test coverage and surface gaps.

## Steps

1. Run `cd server && npm run test:coverage`.
2. Parse the coverage summary from `server/coverage/coverage-summary.json` (preferred) or the terminal output.
3. Cross-check against the thresholds defined in `server/jest.config.js`:
   - `src/utils/` — 100% branches, functions, lines, statements
   - `src/controllers/` — 100% on all
   - `src/middleware/` — 90% branches, 100% on the rest
   - `src/services/authService.js`, `cacheService.js`, `habitService.js`, `streakService.js`, `userService.js` — 100% on all

## Reporting

Produce a punch list of every file that fails its threshold, in this format:

```
<file path>
  branches  92.5% (target 100%)
  uncovered lines: 47, 102-105, 188
```

Then propose a brief plan — for each gap, suggest which test file to edit and what scenario to add. Don't write the tests unless the user asks; just propose them.

If everything is at or above threshold, report "All thresholds met" and the overall numbers (lines, branches, functions, statements). End there.

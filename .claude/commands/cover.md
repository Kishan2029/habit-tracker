---
description: Run server test coverage and report files below threshold, with a plan to fix them.
---

Audit server test coverage and surface gaps.

## Steps

1. Run `cd server && npm run test:coverage`.
2. Parse the coverage summary from `server/coverage/coverage-summary.json` (preferred) or the terminal output.
3. Read the current thresholds from `server/jest.config.js` (the `coverageThreshold` key). Do not rely on any hardcoded numbers — always use whatever the config file says at the time of the run.

## Reporting

Produce a punch list of every file that fails its threshold, in this format:

```
<file path>
  branches  92.5% (target 100%)
  uncovered lines: 47, 102-105, 188
```

Then propose a brief plan — for each gap, suggest which test file to edit and what scenario to add. Don't write the tests unless the user asks; just propose them.

If everything is at or above threshold, report "All thresholds met" and the overall numbers (lines, branches, functions, statements). End there.

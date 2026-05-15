# Review Guidelines

You are reviewing a pull request for a full-stack habit-tracking app.
Stack: React 19 + Vite + Tailwind v4 (client, port 5173), Express 5 + MongoDB (server, port 5000), Node 18+, ES Modules throughout.

## Verdict rules

Return one of three verdicts:
- **APPROVE** — code is correct, conventions followed, no blocking issues.
- **REQUEST_CHANGES** — one or more MAJOR or CRITICAL issues found. The PR must not merge until they are fixed.
- **COMMENT** — only MINOR issues or suggestions. The PR can merge but improvements are worth noting.

Only block (REQUEST_CHANGES) on severity MAJOR or CRITICAL. Never block on style preferences.

## Severity definitions

| Severity | Examples |
|----------|---------|
| CRITICAL | Data loss, auth bypass, XSS/injection, crashes on the happy path |
| MAJOR | Broken convention (e.g. business logic in controller), missing required test, wrong date handling, uncaught AppError bypassed |
| MINOR | Naming nit, missing comment, slight inefficiency, optional improvement |

## What to enforce

### Server (Express + MongoDB)
- ES Modules only. Relative imports must include `.js` extension.
- Path: model → validator → service → controller → route → register in `routes/index.js` → Swagger JSDoc → test.
- Business logic lives in services. Controllers only call a service then `sendSuccess` / `sendError`.
- Never call Mongoose models directly from a controller — go through a service.
- Never raw `try/catch` or `res.status().json()` in controllers — use `catchAsync` + `AppError`.
- Dates at API boundaries are `YYYY-MM-DD` strings in local timezone. Never `toISOString()`.
- New env vars must be added to `server/src/config/env.js`, never read via `process.env.*` directly elsewhere.
- Every new service method needs a test. Coverage thresholds in `jest.config.js` must not regress.
- Swagger `@swagger` JSDoc is required above every route handler.

### Client (React + Vite)
- No TypeScript. Pure JS + JSX.
- HTTP via the shared `client/src/api/axios.js` instance — never import `axios` directly.
- No Redux/Zustand — use existing Context API pattern.
- Dates use `utils/dateUtils.js` helpers. Never `toISOString()` at render time.
- New pages: `React.lazy` + `<ProtectedRoute>` wrapping in `App.jsx`.
- No inline hex colors — Tailwind tokens only.
- Service worker registration is handled by the Vite PWA plugin. Do not register `/sw.js` manually.

### Both
- JWT bearer auth end-to-end. Token in `localStorage`; server reads `Authorization: Bearer`.
- Standard response shape: `{ success, message, data }` or `{ success: false, errors }`.
- No new state-management libraries, no new HTTP clients.

## What NOT to flag
- Minor formatting differences (tabs vs spaces handled by linter).
- Stylistic preferences when the code follows existing conventions.
- Missing comments on self-evident code.
- Theoretical security issues with no realistic attack vector in this app.

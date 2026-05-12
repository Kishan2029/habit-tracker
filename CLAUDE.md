# CLAUDE.md — Habit Tracker

This file is the entrypoint Claude reads when working in this repo. Keep it short. Scope-specific rules live in `client/CLAUDE.md` and `server/CLAUDE.md`; deep architectural detail lives in `TECHNICAL.md` and `README.md`.

## What this project is

A full-stack habit-tracking app: React 19 PWA (Vite + Tailwind v4) talking to an Express 5 + MongoDB API. Features include habit CRUD with frequency/category/color/icon, daily logging, streaks with freeze, shared habits with roles, weekly/monthly/yearly analytics, Excel/PDF export, Web Push + email notifications, and scheduled cron jobs (daily reminders, missed alerts, weekly summary).

Product spec: `README.md`. Architecture deep-dive: `TECHNICAL.md`. Live API docs: `http://localhost:5000/api-docs` (Swagger UI, dev only).

## Repo layout

```
habit-tracker-claud/
├── client/         npm workspace — React + Vite frontend (port 5173)
├── server/         npm workspace — Express + Node backend (port 5000)
├── package.json    workspace root (concurrently runs both)
├── vercel.json     deployment routing
├── README.md       product documentation
├── TECHNICAL.md    architecture, data models, middleware chain
└── CLAUDE.md       (this file)
```

Workspaces are wired via npm's `workspaces` field — `npm install` at the root installs both. Vite dev server proxies `/api` to `http://localhost:5000`.

## Dev commands

Run from the repo root unless noted.

| Task | Command |
|------|---------|
| Install everything | `npm install` |
| Run both client + server | `npm run dev` |
| Run server only | `npm run server` |
| Run client only | `npm run client` |
| Run server tests | `cd server && npm test` |
| Server test coverage | `cd server && npm run test:coverage` |
| Lint client | `cd client && npm run lint` |
| Build client | `cd client && npm run build` |

No top-level test or lint script — server tests live in the server workspace, client lint lives in the client workspace.

## Environment files

- `server/.env.development` — local dev (Mongo, JWT, email provider, Cloudinary, VAPID)
- `server/.env.production` — production values
- `client/.env.development` — `VITE_API_URL` (defaults to `/api`) and `VITE_VAPID_PUBLIC_KEY`
- `client/.env.production` — same shape as dev

`server/src/config/env.js` is the single source of truth for server env access. **Never read `process.env.*` directly outside that file** — import from `../config/env.js` so missing-required-vars fail fast on boot.

`MONGODB_URI` and `JWT_SECRET` are required; the server exits with a clear error if either is missing.

## Global conventions

- **ES Modules only**, on both client and server (`"type": "module"`). Use `import`/`export`, not `require`. Include the `.js` extension on relative imports in server code.
- **No TypeScript.** Pure JavaScript + JSX. Don't introduce `.ts` files or type annotations.
- **Node 18+.** ES2022 syntax is fine; no transpilation.
- **JWT bearer auth** end-to-end. Token lives in `localStorage` on the client; server reads `Authorization: Bearer <token>`.
- **Standard API response shape**, always:
  ```json
  // success
  { "success": true, "message": "...", "data": { ... } }
  // error
  { "success": false, "message": "...", "errors": [ ... ] }
  ```
  Server uses `sendSuccess` / `sendError` from `server/src/utils/responseFormatter.js`. Client expects `response.data.data.<resource>`.
- **Dates as `YYYY-MM-DD` strings** in local timezone at app boundaries (API params, log dates, freeze dates). UTC `toISOString()` shifts dates across timezones — use `client/src/utils/dateUtils.js` helpers (`getLocalDateString`, `shiftDate`, `parseLocalDate`).

## Where things live

- New backend feature → see `server/CLAUDE.md`. Path: model → validator → service → controller → route → register in `server/src/routes/index.js` → Swagger annotation → test.
- New frontend feature → see `client/CLAUDE.md`. Path: `api/*.js` module → component(s) under the right `components/<domain>/` folder → route in `App.jsx` if it's a page.

## What NOT to do

- Don't add a state management library (Redux/Zustand). Use the existing Context API pattern.
- Don't introduce a new HTTP client. Use the shared `client/src/api/axios.js` instance.
- Don't put business logic in controllers — services hold it; controllers only orchestrate.
- Don't touch Mongoose models from controllers — go through a service.
- Don't manually register `/sw.js`. The Vite PWA plugin handles service worker registration (`injectManifest` strategy).
- Don't bypass `AppError` + `catchAsync` for server error handling — they wire into the global `errorHandler`.

## Pointers

- Frontend rules → `client/CLAUDE.md`
- Backend rules → `server/CLAUDE.md`
- Feature surface area, product copy → `README.md`
- Architecture diagrams, data models, request lifecycle → `TECHNICAL.md`
- Live API reference → `/api-docs` (Swagger, dev only)

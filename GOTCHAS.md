# Gotchas

Booby traps in this codebase that have bitten us before. Skim before refactoring or adding a feature in the relevant area. New entries welcome — keep them terse.

## Dates and timezones

- **Never** call `date.toISOString().split('T')[0]` to make a date string. It converts to UTC first and silently shifts the day for users not in UTC. Use `getLocalDateString` from `client/src/utils/dateUtils.js` (client) or `dateHelpers.js` (server).
- API date params are always `YYYY-MM-DD` in the **user's local timezone** — never UTC. See ADR 0002.
- `shiftDate(str, days)` is the only correct way to do "N days ago" on a date string. Don't add milliseconds to `new Date(str)` — DST will bite you at the boundaries.
- Server-side cron jobs (daily reminder, missed alert) use `user.settings.timezone` to compute "what is today for this user." If you add a new job that runs per-user, do the same.
- `HabitLog.date` is stored as **UTC midnight** in Mongo, but the API surface is `YYYY-MM-DD` strings. Don't expose the raw `Date` to the client.

## Auth

- `User.passwordHash` has `select: false`. Any query that needs it must use `.select('+passwordHash')` explicitly — and only `authService` should be doing that.
- When you reset or change a password, you **must** set `user.passwordChangedAt = new Date()`. The `authenticate` middleware rejects tokens issued before that timestamp. Forgetting this means stale tokens stay valid until expiry.
- The 401 axios interceptor on the client redirects to `/login` — but it skips the redirect on `/login`, `/register`, `/forgot-password`, `/reset-password` so that "wrong password" doesn't bounce the user. If you add a new auth page, add it to that allow-list in `client/src/api/axios.js`.
- JWTs are stored in `localStorage`. There is no refresh-token flow; tokens expire after `JWT_EXPIRES_IN` (default 7d).

## Mongoose / cache

- **Every write to a cached resource must invalidate the cache.** `habitService` has a private `_invalidateCache(userId)` called from create/update/archive/unarchive/delete/reorder. If you add a new write method, call it. If you add caching to a new service, copy the pattern.
- **Caches that derive from logs OR habits must be invalidated from both write paths.** Example: `insights:<userId>` (correlation analytics) is wiped by `logService.createOrUpdate` (log writes) AND by `habitService._invalidateCache` (habit set / frequency / target / archive changes). If you add a new derived cache, audit every service that mutates its inputs — the cache key won't enumerate the inputs for you.
- Cache is in-process (node-cache, per-instance). If we scale horizontally, this becomes a stale-read source — see ADR 0005.
- Mongoose enums come from `server/src/config/constants.js`. Don't redefine enum values in the schema directly — use the constants so validator + model + frontend can share them.
- Compound indexes matter for query performance — `(userId, isArchived)`, `(habitId, userId, date) UNIQUE`, etc. If you add a new query pattern in a service, check whether it has an index covering it.

## Service worker / PWA

- **Do not** `navigator.serviceWorker.register('/sw.js')` in `main.jsx`. The Vite PWA plugin (`injectManifest` strategy) registers `src/sw.js` automatically. Double registration creates SW conflicts and breaks push.
- The custom service worker handles `push` events and `notificationclick`. If you add a new notification type, update `sw.js` to handle the new `data.url` or `data.tag`.
- `VITE_VAPID_PUBLIC_KEY` is bundled into the client at build time. If you rotate VAPID keys, you must rebuild the client.

## Express / middleware order

- Middleware order in `server/src/app.js` matters: `helmet → compression → cors → morgan → json → routes → 404 → errorHandler`. Don't reorder without understanding why.
- Per-route order is `rateLimiter → authenticate → authorize → <validatorRules> → validate → controller`. Same warning.
- The `validate` middleware **must** come after the validator-rule array — `validate` reads `validationResult(req)` which is populated by the rules.
- Don't `res.status(...).json(...)` for errors in controllers. Throw `AppError(message, statusCode)` and let the global `errorHandler` format it.

## Controllers / services

- **Controllers don't touch Mongoose.** Ever. Go through a service.
- **Services don't touch `req` / `res`.** They take primitive args and return data or throw `AppError`.
- Services are singleton instances: `export default new MyService()`. If a method needs different config per call, take that config as an argument — don't mutate instance state.
- `catchAsync` forwards rejections to `next()`. Don't wrap a `catchAsync` controller body in `try/catch` — that defeats the purpose.
- **When computing `REPO_ROOT` from a `__filename`/`import.meta.url`, count levels carefully.** `config.mjs` sits at `.github/scripts/ai-pr/lib/` (4 levels deep), so the correct traversal is `'../../../..'` (4 `..` segments). Using one extra `..` walks above the repo root and breaks every `repoPath()` call on CI where the checkout adds an extra directory level.
- **Never use `notes: notes || ''` in a `findOneAndUpdate` call** — when `notes` is absent from the request, `undefined || ''` resolves to `''` and Mongoose's implicit `$set` overwrites any existing note with an empty string. Instead, conditionally include `notes` in `$set` only when it is `!== undefined`, and use `$setOnInsert: { notes: '' }` to set the schema default only on new-document creation.

## Mobile gestures

- **Never enable `trackMouse` on `useSwipeable`.** A mouse-drag during text selection on desktop would fire a swipe and (e.g.) jump the date or undo a habit. Gate every gesture on `useIsTouchDevice()`.
- **Don't nest horizontal-swipe handlers.** The Today view puts swipe-to-toggle on each habit card; date nav is its own row. If you add another horizontal swipe in the same scrolling area, expect both to fire and drop one.
- **Pull-to-refresh uses window `scrollY`.** It only fires when the page is scrolled to the top — adding a separate scroll container around `HabitList` would break it; route the scroll back to the window or move the listener.
- `react-swipeable` doesn't expose `stopPropagation`. If two swipe regions overlap, use disjoint DOM regions, not z-index hacks.

## Shared habits

- A shared habit's permission check happens in the **service layer**, not in middleware. The role matrix is in `TECHNICAL.md` and enforced in `sharedHabitService.js`. Don't add a shortcut middleware that fakes this — roles depend on `(userId, habitId)` lookups.
- Streaks for shared habits are per-user. Only the owner's streak is persisted on the `Habit` document; members' streaks are computed on demand.
- Archiving or deleting a habit fails if it has an active share. The owner must `unshare` first. The error message says so — don't catch it and swallow.

## Tests

- Jest runs with `NODE_OPTIONS='--experimental-vm-modules'` for ESM. If a test fails with "Cannot use import statement", you forgot the env var or the script is bypassing `npm test`.
- Use `jest.unstable_mockModule(...)` for ESM mocks, **before** the dynamic `await import(...)` of the module under test. The pattern is in every existing test file.
- Coverage thresholds in `jest.config.js` are strict (100% for utils/controllers/middleware and several services). Adding code without tests will fail CI.
- The `setupFiles: ['<rootDir>/src/__tests__/setupEnv.js']` injects fake env vars so `config/env.js` doesn't crash on missing `MONGODB_URI` / `JWT_SECRET`. Don't delete this file.

## Email

- Email is fire-and-forget. Wrap every `emailService.*` call in `.catch(() => {})` at the call site so a transient SMTP failure doesn't kill the user's HTTP request.
- If no email provider is configured, sends fall back to console logging — useful in dev, but means "I sent the email" can mean "I logged it." Check the dev console.
- `EMAIL_FROM` must match a verified sender on the chosen provider (Resend / Brevo). Otherwise the provider silently drops the message.

## Client / React 19

- We use React 19 in strict mode. Components mount **twice** in development; effects fire twice. Any effect with non-idempotent side effects (analytics events, single-fire fetches with no cancellation) needs an abort/cleanup path or a `useRef` guard.
- React Router 7 is in use — the loader/action API is available but **we don't use it**. Stay on `useEffect` + `src/api/*` calls so the pattern is uniform.
- `<Toaster>` is mounted once in `App.jsx`. Don't mount a second one in a page.
- The `<ErrorBoundary>` is at the very root. Page-level boundaries are fine if a specific widget can fail in isolation — but make them additive, don't remove the root one.

## Deployment

- `vercel.json` rewrites `/(.*)` to `/index.html` for SPA routing — don't add a route that needs server-side handling without updating it.
- Both client and server are on Vercel. The server runs as a function; cold starts apply. The cron jobs need a non-serverless host (currently a separate worker / Render service) — confirm before assuming `node-cron` "just runs" in production.
- `MONGODB_URI` and `JWT_SECRET` are **required**. The server `process.exit(1)`s on boot if either is missing. This is intentional — don't add fallbacks for these in `config/env.js`.

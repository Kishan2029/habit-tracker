# CLAUDE.md — Server (Express + MongoDB)

Scope: everything under `server/`. For repo-wide rules see `../CLAUDE.md`.

## Stack

- **Express 5** with `express.json` body parser, helmet, compression, cors, morgan
- **MongoDB + Mongoose 9** (ES modules)
- **JWT** auth via `jsonwebtoken`, password hashing via `bcryptjs` (12 rounds, hook on User)
- **express-validator** for input validation
- **swagger-jsdoc + swagger-ui-express** — Swagger UI at `/api-docs` in dev
- **node-cron** for scheduled jobs (cron expressions in `jobs/`)
- **node-cache** for in-memory caching (per-instance)
- **web-push** for browser push notifications
- **nodemailer** + Resend + Brevo — three email providers behind a single factory
- **multer** for avatar upload, **cloudinary** for storage
- **ExcelJS / PDFKit** for data export
- **Jest 30** with `--experimental-vm-modules` for ESM testing

ES modules, no TypeScript. Server runs on port 5000 (configurable via `PORT`).

## Layered architecture — strict

```
HTTP request
   ↓
middleware (helmet → compression → cors → morgan → json)
   ↓
routes/             ← thin: wire URL → middleware chain → controller
   ↓
middleware (rateLimiter → authenticate → authorize → validate)
   ↓
controllers/        ← thin: read req, call service(s), call sendSuccess
   ↓
services/           ← business logic, transactions, cross-model coordination
   ↓
models/             ← Mongoose schemas — fields, indexes, hooks, instance methods
   ↓
MongoDB
```

**Hard rules:**

1. **Controllers don't touch Mongoose models.** They only call services.
2. **Services don't touch `req` / `res`.** They take primitives/ids and return data or throw `AppError`.
3. **Routes don't contain logic.** They wire middleware → controller. Validation rules live in `validators/`; only express-validator chains belong inline in a route (rare exception: a one-off `param('id').isMongoId()`).
4. **Models contain schema + hooks + instance methods only.** No querying logic. That goes in services.

## Folder layout

```
server/src/
├── app.js                Express app — middleware chain, route mounting, 404, errorHandler
├── index.js              entry — connectDB, start cron jobs, listen, graceful shutdown
├── config/
│   ├── env.js            single source of truth for env vars (validates required ones)
│   ├── db.js             mongoose.connect with retry
│   ├── constants.js      enums (HABIT_TYPES, HABIT_CATEGORIES, ALL_DAYS, …)
│   ├── cloudinary.js     Cloudinary SDK init
│   └── swagger.js        swagger-jsdoc options
├── routes/
│   ├── index.js          mounts /auth /users /habits /logs /export /push /shared /feedback
│   └── <resource>Routes.js
├── controllers/          thin orchestration; uses catchAsync + sendSuccess
├── services/             business logic; throws AppError; uses cacheService when hot
│   └── email/            provider factory + templates + provider implementations
├── models/               Mongoose schemas
├── middleware/
│   ├── authenticate.js   JWT verification, attaches req.user, checks passwordChangedAt
│   ├── authorize.js      role-based gate: authorize('admin') etc.
│   ├── validate.js       runs express-validator chains, returns 400 on failure
│   ├── rateLimiter.js    in-memory IP-based limiter; per-route configurable
│   ├── errorHandler.js   global; maps Mongo/JWT errors to status codes
│   └── upload.js         multer config for avatar uploads
├── validators/           express-validator rule arrays (one file per resource)
├── jobs/                 cron jobs — daily reminders, missed alerts, weekly summary
├── utils/
│   ├── AppError.js       operational error class (statusCode + isOperational)
│   ├── catchAsync.js     wraps async controllers; forwards rejections to errorHandler
│   ├── responseFormatter.js  sendSuccess / sendError
│   └── dateHelpers.js    timezone-aware day boundaries
├── scripts/              one-off CLI scripts (migrations, etc.)
└── __tests__/            Jest tests mirroring the src tree
```

## Middleware chain — the order

Defined in `app.js` (global) and per-route (local). **Order matters; don't reshuffle without reason.**

Global:
1. `helmet()` — security headers
2. `compression()` — gzip
3. `cors({ origin, credentials })` — whitelist in prod, allow-all in dev
4. `morgan('dev')` — dev only
5. `express.json({ limit: '10kb' })` — body size cap

Per route, in this order:
1. `rateLimiter({ windowMs, max })` — only for sensitive endpoints (auth, password reset, feedback)
2. `authenticate` — verifies JWT, attaches `req.user`, rejects if password changed after token issue
3. `authorize('admin')` — role gate (rare; mostly `user` is sufficient)
4. `<validatorRules>` (from `validators/<resource>Validators.js`)
5. `validate` — checks `validationResult`, returns 400 with `[{field, message}]`
6. Controller

After all routes:
7. 404 handler — `{ success: false, message: 'Route ... not found' }`
8. Global `errorHandler` — maps Mongo/JWT/AppError to JSON

## Error handling

**The only sanctioned pattern:**

```js
// controller
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';
import habitService from '../services/habitService.js';

export const getHabit = catchAsync(async (req, res) => {
  const habit = await habitService.getById(req.params.id, req.user._id);
  sendSuccess(res, { habit }, 'Habit retrieved');
});
```

```js
// service throws operational errors
import AppError from '../utils/AppError.js';

async getById(id, userId) {
  const habit = await Habit.findById(id);
  if (!habit) throw new AppError('Habit not found', 404);
  if (habit.userId.toString() !== userId.toString()) {
    throw new AppError('Not authorized to access this habit', 403);
  }
  return habit;
}
```

The global `errorHandler` already handles:
- Mongoose duplicate key (`11000`) → 400
- Mongoose `ValidationError` → 400
- Mongoose `CastError` → 400
- JWT `JsonWebTokenError` / `TokenExpiredError` → 401
- Anything else falls back to `err.statusCode || 500`

**Don't `try/catch` and re-throw in controllers.** `catchAsync` forwards rejections to `next()`. Don't write `res.status(...).json(...)` for errors in controllers — throw `AppError` and let the global handler format it.

## Auth

- `authenticate` reads `Authorization: Bearer <token>`, verifies with `env.jwtSecret`, loads the user, checks `passwordChangedAt > token.iat` (force re-login on password change), and sets `req.user`.
- `authorize('admin', 'premium')` is a factory — passes if `req.user.role` is in the allowed set.
- Routes that require auth call `router.use(authenticate)` once at the top (see `habitRoutes.js`) — don't sprinkle it on each handler.
- JWT secret: `env.jwtSecret`. Expiry: `env.jwtExpiresIn` (default `7d`).
- Password hashing happens in the `User` pre-save hook (bcrypt, 12 salt rounds). Reset tokens are SHA-256 hashes of a 32-byte hex token, with a 30-min expiry.

## Validation

Every write endpoint should have:

1. A rule array in `validators/<resource>Validators.js` using `express-validator`:
   ```js
   export const createHabitRules = [
     body('name').trim().notEmpty().withMessage('Habit name is required').isLength({ max: 100 }),
     body('type').optional().isIn(Object.values(HABIT_TYPES)),
     // ...
   ];
   ```
2. The route wires `<rules>` → `validate` → controller:
   ```js
   router.post('/', createHabitRules, validate, createHabit);
   ```

Param validation (`isMongoId`, etc.) can be inline in the route file when it's a single rule. **Don't validate in the service.** Validation is an HTTP-layer concern; services trust their inputs and check business invariants (ownership, conflicts) separately.

## Services

Services are **singleton class instances** exported via `export default new HabitService()`. Methods are async, take primitives/ids, and throw `AppError` on business-rule violations.

Use `cacheService` (`node-cache` wrapper) for hot read paths. Invalidate on writes — `habitService` has a private `_invalidateCache(userId)` that wipes all `habits:<userId>*` keys after create/update/archive/delete/reorder. Cache TTLs are short (e.g. 120s) — this is a per-instance cache and not a substitute for query optimization.

Cross-resource operations belong in one service that imports another (e.g. `habitService` deletes associated `HabitLog` and `SharedHabit` documents on habit delete). Don't fan out across multiple controllers.

## Models

- `User`, `Habit`, `HabitLog`, `SharedHabit`, `StreakFreeze`, `PushSubscription`, `Feedback`.
- Use `{ timestamps: true }` for `createdAt` / `updatedAt`.
- Add compound indexes for query patterns (e.g. `habitSchema.index({ userId: 1, isArchived: 1 })`).
- `enum`s come from `config/constants.js` — don't hard-code them in schemas.
- `passwordHash` on User has `select: false` — never returned in queries by default.
- `toJSON` on User strips `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`.

Schema fields, hooks, methods, and indexes only. **No `.find()` / `.aggregate()` calls in models** — those go in services.

## Routes

- One file per resource: `routes/<resource>Routes.js`.
- Register it in `routes/index.js` with the URL prefix.
- Apply `router.use(authenticate)` at the top for resources that require auth (the only public routes today are under `/auth` and a couple of `/shared` preview endpoints).
- Add `@swagger` JSDoc above each route — Swagger UI is the only public API reference.
- For the rate limiter pattern, see `routes/authRoutes.js` (e.g. 10 registrations / 15min).

## Scheduled jobs

`jobs/` has three cron jobs, all started in `index.js`:

- `dailyReminder.js` — fires at user-configured time, timezone-aware
- `missedAlert.js` — daily at 10 AM, alerts on yesterday's misses
- `weeklySummary.js` — weekly digest

Each exports a `start*Job()` function that schedules a `cron.schedule(...)`. **Don't mix job logic with services** — the job file should orchestrate; the actual work belongs in a service (`notificationService`, `weeklySummaryService`, etc.).

## Caching

- `services/cacheService.js` wraps `node-cache`. Methods: `get`, `set`, `del`, `delByPrefix`.
- Use it for read-heavy endpoints that hit the same query repeatedly (habit lists, freeze status).
- **Always invalidate** on any write to the cached resource. The pattern is private `_invalidateCache(userId)` methods on services.
- Per-instance cache. If we ever scale horizontally, this becomes a problem — flag it; don't silently rely on it for correctness.

## Email

- `services/email/providerFactory.js` chooses SMTP / Resend / Brevo based on `env.email.provider`.
- Templates in `services/email/templates.js` — HTML strings with inline styles.
- `emailService.js` is the public API: `sendWelcome`, `sendVerificationCode`, `sendPasswordReset`, `sendSharedHabitInvite`, etc.
- Email failures should not crash the calling request — wrap in `try/catch` at the service boundary and log.

## Testing

- Jest 30 with `NODE_OPTIONS='--experimental-vm-modules'` (ESM support). Run: `npm test`.
- Tests mirror the source tree under `src/__tests__/`. Setup file: `src/__tests__/setupEnv.js`.
- Coverage thresholds (`jest.config.js`) are **strict** for utils, controllers, middleware, and most services — 100% lines/branches/functions on those. New code in those layers must come with tests that keep coverage at 100%.
- Routes and validators are excluded from coverage collection — they're declarative.
- Run a focused file: `npx jest path/to/file.test.js`.
- Watch mode: `npm run test:watch`. HTML coverage report: `npm run test:report` (opens `coverage/index.html`).

## Adding a backend feature — checklist

1. **Model** — add a Mongoose schema in `models/<Resource>.js`. Indexes, hooks, methods only.
2. **Constants** — add any new enums to `config/constants.js`.
3. **Validator** — create `validators/<resource>Validators.js` with rule arrays (`createXRules`, `updateXRules`, …).
4. **Service** — create `services/<resource>Service.js`. Singleton instance, async methods, throw `AppError` on business-rule violations. Add caching if hot.
5. **Controller** — create `controllers/<resource>Controller.js`. Each handler is `catchAsync` + `sendSuccess`. No try/catch, no Mongoose access.
6. **Route** — create `routes/<resource>Routes.js`. `router.use(authenticate)` if auth required. Wire `<rules>` → `validate` → handler. Add Swagger JSDoc.
7. **Register** — add the route mount in `routes/index.js`.
8. **Tests** — add unit tests under `__tests__/services/`, `__tests__/controllers/`. Hit the coverage thresholds.
9. **Run** — `npm test`, then exercise via Swagger UI at `/api-docs` in dev.

## Don'ts

- Don't read `process.env.*` outside `config/env.js`.
- Don't call `res.status(...).json(...)` for errors — throw `AppError`.
- Don't put `try/catch` inside `catchAsync`-wrapped controllers.
- Don't query Mongoose from controllers.
- Don't put business validation in models or validators — those are for shape; business rules (ownership, conflicts) belong in services.
- Don't introduce a new logger without flagging it. Today: `console.*` + morgan. If structured logging is needed, that's a separate decision.
- Don't change the API response shape (`{ success, message, data }`) — the client depends on it.

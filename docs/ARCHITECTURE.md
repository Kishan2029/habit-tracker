# Architecture

How requests flow through the system, what middleware runs in what order, and how the major subsystems plug together. For schema details, see `DATA_MODELS.md`. For testing setup, see `TESTING.md`. For *why* we made specific structural choices, see `decisions/`.

---

## 1. System overview

```
                ┌──────────────────────────────────┐
                │          React SPA (PWA)          │
                │   Vite + Tailwind + React Router  │
                └──────────────┬───────────────────┘
                               │  Axios (JWT Bearer)
                               ▼
                ┌──────────────────────────────────┐
                │        Express 5 API Server       │
                │  helmet → cors → json → morgan    │
                │  → routes → 404 → errorHandler    │
                └──────┬───────┬───────┬───────────┘
                       │       │       │
          ┌────────────┘       │       └────────────┐
          ▼                    ▼                     ▼
 ┌─────────────┐     ┌─────────────┐      ┌─────────────────┐
 │   MongoDB    │     │ Cloudinary  │      │  Email Provider  │
 │  (Mongoose)  │     │  (Avatars)  │      │ SMTP/Resend/Brevo│
 └─────────────┘     └─────────────┘      └─────────────────┘
```

**Monorepo** — npm workspaces with two packages:

| Package | Path | Port (dev) |
|---------|------|------------|
| Client | `client/` | 5173 |
| Server | `server/` | 5000 |

Vite dev server proxies `/api` requests to `http://localhost:5000`.

---

## 2. Request lifecycle

Every request passes through this middleware chain (in order):

1. `helmet()` — security headers
2. `compression()` — gzip response compression
3. `cors()` — origin whitelist (production) or allow-all (development)
4. `morgan('dev')` — HTTP logging (dev only)
5. `express.json({ limit: '10kb' })` — JSON body parser
6. Route-level middleware: `rateLimiter` → `authenticate` → `authorize` → `<validatorRules>` → `validate` → controller
7. 404 handler
8. Global `errorHandler`

The order is enforced in `server/src/app.js` (global) and per-route in `server/src/routes/<resource>Routes.js`. **Don't reshuffle without reason.** See `GOTCHAS.md` for what breaks when you do.

---

## 3. Layered backend

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

Hard rules:

- **Controllers don't touch Mongoose models.** They only call services.
- **Services don't touch `req` / `res`.** They take primitives/ids and return data or throw `AppError`.
- **Routes don't contain logic.** They wire middleware → controller.
- **Models contain schema + hooks + instance methods only.** No querying logic. That goes in services.

---

## 4. Authentication & authorization

### JWT flow

```
Register/Login
      │
      ▼
  Generate JWT ──► payload: { id: userId }, expires: 7d (configurable)
      │
      ▼
  Client stores token in localStorage
      │
      ▼
  Every request: Authorization: Bearer <token>
      │
      ▼
  authenticate middleware:
    1. Decode token
    2. Find user in DB
    3. Check passwordChangedAt > token.iat → reject if password changed after token issued
    4. Attach user to req.user
```

**Token invalidation:** When a user changes or resets their password, `passwordChangedAt` is set to `new Date()`. All previously issued tokens (where `iat < passwordChangedAt`) are rejected.

### Role-based authorization

The `authorize(...roles)` middleware checks `req.user.role` against allowed roles. Returns 403 if not authorized.

### Shared habit permissions

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| editHabit | x | x | | |
| deleteHabit | x | | | |
| invite | x | x | | |
| removeMember | x | x | | |
| changeRole | x | | | |
| logCompletion | x | x | x | |
| viewProgress | x | x | x | x |
| transferOwnership | x | | | |
| leave | | x | x | x |

Permission checks happen in the **service layer**, not middleware — roles depend on `(userId, habitId)` lookups.

### Rate limiting

In-memory per-IP store (`Map` with auto-cleanup every 60s):

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Register | 15 min | 10 |
| Login | 15 min | 20 |
| Forgot password | 15 min | 5 |
| Feedback | 60 min | 5 |
| Default | 15 min | 100 |

---

## 5. Services layer

All services are exported as singleton instances.

### `streakService.calculateStreaks(logs, frequency, target, habitCreatedAt)`

Returns `{ currentStreak, longestStreak }`.

Algorithm:

1. Build a `completedSet` (Set of YYYY-MM-DD strings) from logs where:
   - Boolean habits: `value === true`
   - Count habits: `value >= target`
2. Determine `startDate`: habit creation date, or earliest log date if backdated logs exist
3. Build `scheduledDates`: all dates from startDate to today matching the habit's `frequency` (day-of-week)
4. **Longest streak (forward pass):** iterate scheduledDates, count consecutive completions, track max
5. **Current streak (backward pass):** start from latest scheduled date, skip today if not completed (day isn't over), count backwards until a gap

For shared habits, per-user streaks are calculated separately. Only the owner's streaks are persisted on the `Habit` document.

### `cacheService` (NodeCache)

- Default TTL: 300 seconds
- Check period: 60 seconds
- **Prefix-based invalidation:** keys like `habits:userId:archived=false` are tracked under prefixes `habits`, `habits:userId`, etc. Calling `delByPrefix("habits:userId")` deletes all matching keys in O(1) via a lookup map.
- Used by `habitService` (TTL 120s) to cache habit lists.

See ADR 0005 (`docs/decisions/0005-node-cache-per-instance.md`) for the rationale and trigger to revisit.

### `emailService`

Provider abstraction via `services/email/providerFactory.js`. Configured via `EMAIL_PROVIDER` env var.

| Provider | Env Vars Required |
|----------|------------------|
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Resend | `RESEND_API_KEY` |
| Brevo | `BREVO_API_KEY` |

Falls back to console logging if no provider is configured.

Email types: welcome, password reset link, password reset confirmation, password changed notification, shared habit invite, feedback admin notification, weekly summary.

All sends are fire-and-forget — call sites wrap in `.catch(() => {})` so an email failure never fails the originating request. See ADR 0004 and `GOTCHAS.md`.

### `exportService`

**Excel (`generateExcel`)** — 3 sheets:

1. **Summary:** habit metadata, completion %, streaks. Conditional formatting: green ≥ 75%, yellow ≥ 50%, red < 50%.
2. **Daily Log:** date, day, week#, habit, value, completed, notes. Auto-filter enabled.
3. **Weekly View:** date columns per habit with checkmarks/values. Week separators.

**PDF (`generatePDF`)** — sections:

1. **Cover page:** date range, 4 stat boxes (total habits, completion %, best habit, best day).
2. **Category pages:** habits grouped by category with accent color bars, completion rates, streaks.
3. **Daily grid:** abbreviated habit names, symbols (checkmark/cross/values), alternating row backgrounds.

Both exports include owned and shared habits.

### `logService`

- `createOrUpdate`: uses `findOneAndUpdate` with upsert (atomic create-or-update).
- Validates: `date ≤ today`, `date ≥ (today − 7 days)`, `date ≥ habit creation date`.
- Shared-habit authorization: owner, admin, or member can log; viewers cannot.
- After logging, `updateStreaks()` runs asynchronously (errors caught, don't fail the request).
- `getDailyLogs`: 3-phase parallel query for optimal performance.
- `getYearlyLogs`: MongoDB aggregation pipeline for monthly stats.

---

## 6. Cron jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily reminder | per-user configured time | Push notification reminding the user to log scheduled habits |
| Missed alert | 10:00 user local time | Push if yesterday's scheduled habits were not logged |
| Weekly summary | `0 9 * * 0` (Sunday 9 AM) | Email + push with weekly completion stats |

Implemented via `node-cron`. Each job has a file in `server/src/jobs/` that exports `start<Name>Job()`. They're started in `server/src/index.js` after the DB connection.

Jobs orchestrate; actual work belongs in a service (`notificationService`, `weeklySummaryService`, etc.).

---

## 7. Frontend

### Routing

| Route | Component | Auth | Lazy |
|-------|-----------|:----:|:----:|
| `/login` | LoginPage | | |
| `/register` | RegisterPage | | |
| `/forgot-password` | ForgotPasswordPage | | |
| `/reset-password` | ResetPasswordPage | | |
| `/join/:inviteCode` | JoinSharedHabit | | x |
| `/` | → redirect to `/today` | x | |
| `/today` | TodayView | x | |
| `/weekly` | WeeklyView | x | x |
| `/habits` | HabitList | x | |
| `/shared` | SharedHabitsPage | x | x |
| `/analytics` | AnalyticsPage | x | x |
| `/settings` | SettingsPage | x | x |
| `*` | NotFoundPage | | |

Protected routes use `<ProtectedRoute>` which checks `useAuth()` and redirects to `/login`.

### Component tree

```
App
└── ErrorBoundary
    └── AuthProvider
        └── ThemeProvider
            └── BrowserRouter
                └── Routes
                    ├── Public routes
                    └── ProtectedRoute
                        └── AppLayout
                            ├── Sidebar
                            ├── Header
                            ├── <Outlet /> (page content)
                            └── FeedbackButton → FeedbackModal
```

### Context providers

**AuthContext** (`useAuth()`):
- State: `user`, `loading`
- Methods: `login`, `register`, `logout`, `updateUser`
- Persistence: `token` and `user` in `localStorage`
- On 401 response: clears localStorage, redirects to `/login` (via axios response interceptor, with an allow-list for auth pages)

**ThemeContext** (`useTheme()`):
- State: `theme` (user preference: light/dark/system), `resolvedTheme` (computed)
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')`
- Applies `dark` class to `<html>` element
- Persistence: `theme` in localStorage

See ADR 0001 for why we don't use Redux/Zustand/React Query.

### Axios client

- Base URL: `import.meta.env.VITE_API_URL` or `/api`
- **Request interceptor:** injects `Authorization: Bearer <token>` from localStorage
- **Response interceptor:** on 401, clears auth state and redirects to `/login` (skips if already on an auth page)
- 15s timeout

### PWA configuration

```js
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  manifest: {
    name: 'Habit Tracker',
    short_name: 'Habits',
    display: 'standalone',
    theme_color: '#6366f1',
    icons: [192x192, 512x512, 512x512 maskable]
  }
})
```

Custom service worker at `client/src/sw.js`:
- `install`: `self.skipWaiting()` — activate immediately
- `activate`: `clients.claim()` — control all pages
- `push`: displays notification with icon, badge, and tag
- `notificationclick`: navigates to URL from notification data

**Never** call `navigator.serviceWorker.register('/sw.js')` from `main.jsx` — see `GOTCHAS.md`.

### Date handling

- **Client:** dates are `YYYY-MM-DD` strings in **local timezone** (`getLocalDateString()` in `client/src/utils/dateUtils.js`).
- **Server:** stored as UTC midnight in Mongo; API surface is `YYYY-MM-DD` strings.
- **Timezone:** auto-detected on login via `Intl.DateTimeFormat().resolvedOptions().timeZone`, saved to `user.settings.timezone`.

See ADR 0002 and `GOTCHAS.md`.

---

## 8. Input validation

All validators use `express-validator` and are applied at the route level **before** controllers.

Rule arrays live in `server/src/validators/<resource>Validators.js`. The `validate` middleware (`server/src/middleware/validate.js`) reads `validationResult(req)` and returns a 400 with `[{field, message}]` on failure.

Coverage summary:

- **Auth** — `name` (max 100), `email` (valid, normalized), `password` (min 6), `resetToken` (hex, length 64)
- **Habits** — `name` (max 100), `type` (enum), `color` (hex `#RRGGBB`), `target` (int ≥ 1), `frequency` (array of 1+, each 0–6), `category` (enum), reorder items (`id` MongoId + `sortOrder` int ≥ 0)
- **Logs** — `habitId` (MongoId), `date` (`YYYY-MM-DD`), `value` (boolean or non-negative number), `notes` (max 500)
- **Shared habits** — `inviteCode` (alphanumeric), `email` (valid, normalized), `role` (enum: admin/member/viewer), `accept` (boolean)
- **Export** — `start`, `end` (`YYYY-MM-DD`)

Don't validate in the service. Validation is an HTTP-layer concern; services trust their inputs and check business invariants (ownership, conflicts) separately.

---

## 9. Error handling

### Global error handler

`server/src/middleware/errorHandler.js` catches all errors and returns consistent JSON responses:

| Error Type | Status | Handling |
|-----------|--------|---------|
| Mongoose duplicate key (11000) | 400 | Extracts field name |
| Mongoose `ValidationError` | 400 | Combines all error messages |
| MongoDB `CastError` (invalid ObjectId) | 400 | "Invalid {path}" |
| `JsonWebTokenError` | 401 | "Invalid token" |
| `TokenExpiredError` | 401 | "Token expired" |
| `AppError` (custom) | custom | Uses provided statusCode |
| Unknown | 500 | "Internal server error" |

In development, error responses include the stack trace.

### Application pattern

```js
// controller
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/responseFormatter.js';

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

**Don't `try/catch` and re-throw in controllers.** `catchAsync` forwards rejections to `next()`. Don't write `res.status(...).json(...)` for errors in controllers — throw `AppError`.

### Client-side

- `ErrorBoundary` component catches React render errors with fallback UI (root-level, in `App.jsx`).
- Toast notifications via `react-hot-toast` for user-facing errors and success.
- `NotFoundPage` for unmatched routes.

---

## 10. Standard response shape

Every API response, success or error:

```json
// success
{ "success": true, "message": "...", "data": { ... } }

// error
{ "success": false, "message": "...", "errors": [ { "field": "...", "message": "..." } ] }
```

Server uses `sendSuccess` / `sendError` from `server/src/utils/responseFormatter.js`. The client expects `response.data.data.<resource>`. **Don't change this shape** — the client depends on it everywhere.

---

## 11. Deployment

### Vercel

Both client and server deploy on Vercel.

Client `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
SPA routing — all paths serve `index.html` for React Router.

### Environment variables

**Server (required):**

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |

**Server (optional):**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | Server port |
| `NODE_ENV` | development | Environment |
| `JWT_EXPIRES_IN` | 7d | Token expiry |
| `CLIENT_URL` | http://localhost:5173 | Frontend URL |
| `CORS_ORIGIN` | CLIENT_URL | Allowed CORS origin |
| `EMAIL_PROVIDER` | smtp | smtp / resend / brevo |
| `EMAIL_FROM` | Habit Tracker \<noreply@...\> | Sender address |
| `SMTP_HOST/PORT/USER/PASS` | — | SMTP config |
| `RESEND_API_KEY` | — | Resend API key |
| `BREVO_API_KEY` | — | Brevo API key |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | — | Image uploads |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | — | Push notifications |
| `ADMIN_EMAIL` | — | Receives feedback notifications |

**Client:**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (default `/api`) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for push |

`server/src/config/env.js` is the single source of truth — **never read `process.env.*` directly elsewhere**. The server `process.exit(1)`s on boot if `MONGODB_URI` or `JWT_SECRET` is missing.

### Database indexes

On startup, `connectDB()` syncs indexes on HabitLog and SharedHabit collections (drops stale, creates missing). New indexes added to a schema are picked up automatically.

### Cron jobs in production

`node-cron` runs in the long-lived server process — confirm before assuming it "just runs" on a serverless host. If the API runs serverless, the cron jobs need a separate worker.

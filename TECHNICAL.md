# Technical Documentation

Detailed technical reference for the Habit Tracker codebase. For API endpoint details, see the Swagger UI at `/api-docs` on the server.

---

## 1. Architecture Overview

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

### Request Lifecycle

Every request passes through this middleware chain (in order):

1. `helmet()` — security headers
2. `compression()` — gzip response compression
3. `cors()` — origin whitelist (production) or allow-all (development)
4. `morgan('dev')` — HTTP logging (dev only)
5. `express.json({ limit: '10kb' })` — JSON body parser
6. Route-level middleware: `rateLimiter` → `authenticate` → `authorize` → `validate` → controller
7. 404 handler
8. Global `errorHandler`

---

## 2. Data Models & Relationships

### Entity Relationships

```
User ──1:N──► Habit ──1:N──► HabitLog
  │              │
  │              └──1:1──► SharedHabit ──► sharedWith[]: { userId, role, status }
  │
  ├──1:1──► PushSubscription
  └──1:N──► Feedback
```

### User

| Field | Type | Constraints |
|-------|------|-------------|
| name | String | required, trim, max 100 |
| email | String | required, unique, lowercase, trim |
| passwordHash | String | required, select: false (excluded from queries) |
| role | String | enum: `user`, `premium`, `admin` — default `user` |
| settings.theme | String | enum: `light`, `dark`, `system` — default `system` |
| settings.timezone | String | default `UTC` |
| avatar.url | String | Cloudinary secure URL |
| avatar.publicId | String | Cloudinary asset ID |
| passwordChangedAt | Date | set on password reset/change |
| resetPasswordToken | String | SHA256 hash of plaintext token |
| resetPasswordExpires | Date | 30-minute expiry |

**Pre-save hook:** hashes `passwordHash` with bcrypt (12 salt rounds) if modified.

**Methods:**
- `comparePassword(candidate)` — bcrypt compare
- `createPasswordResetToken()` — generates 32-byte hex token, stores SHA256 hash, returns plaintext
- `toJSON()` — strips passwordHash, resetPasswordToken, resetPasswordExpires

### Habit

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required |
| name | String | required, trim, max 100 |
| type | String | enum: `boolean`, `count` — default `boolean` |
| unit | String | trim, e.g. "km", "pages" |
| target | Number | min 1, default 1 |
| color | String | hex, default `#6366f1` |
| icon | String | emoji, default `🎯` |
| frequency | [Number] | 0–6 (Sun–Sat), default all days |
| category | String | enum: health, fitness, learning, work, mindfulness, social, finance, other |
| isArchived | Boolean | default false |
| currentStreak | Number | default 0 |
| longestStreak | Number | default 0 |
| sortOrder | Number | default 0 |

**Indexes:** `(userId, isArchived)`, `(userId, sortOrder)`, `(userId, category)`

### HabitLog

| Field | Type | Constraints |
|-------|------|-------------|
| habitId | ObjectId → Habit | required |
| userId | ObjectId → User | required |
| date | Date | required, stored as UTC midnight |
| value | Mixed | boolean or number |
| notes | String | max 500 |

**Indexes:** `(habitId, userId, date)` UNIQUE, `(userId, date)`, `(habitId, date, value)`, `(userId, habitId)`

### SharedHabit

| Field | Type | Constraints |
|-------|------|-------------|
| habitId | ObjectId → Habit | required, unique |
| ownerId | ObjectId → User | required |
| sharedWith | Array | see below |
| inviteCode | String | unique (sparse), 32-char hex |
| isActive | Boolean | default true |

**sharedWith[] element:**

| Field | Type | Default |
|-------|------|---------|
| userId | ObjectId → User | — |
| role | String (admin/member/viewer) | `member` |
| status | String (pending/accepted/declined) | `accepted` |
| joinedAt | Date | now |
| invitedBy | ObjectId → User | — |

**Indexes:** `(habitId)` UNIQUE, `(ownerId)`, `(sharedWith.userId)`, `(inviteCode, isActive)`

### PushSubscription

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required, unique |
| subscription.endpoint | String | required |
| subscription.keys.p256dh | String | required |
| subscription.keys.auth | String | required |

### Feedback

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required |
| mood | String | enum: loved, happy, neutral, confused, sad |
| message | String | trim, max 2000 |
| page | String | trim, max 200 |
| status | String | enum: open, reviewed, resolved — default `open` |

**Indexes:** `(status, createdAt desc)`

---

## 3. Authentication & Authorization

### JWT Flow

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

### Role-Based Authorization

The `authorize(...roles)` middleware checks `req.user.role` against allowed roles. Returns 403 if not authorized.

### Shared Habit Permissions

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

Permission checks happen in the service layer, not middleware.

### Rate Limiting

In-memory per-IP store (Map with auto-cleanup every 60s):

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Register | 15 min | 10 |
| Login | 15 min | 20 |
| Forgot password | 15 min | 5 |
| Feedback | 60 min | 5 |
| Default | 15 min | 100 |

---

## 4. Services Layer

All services are exported as singleton instances.

### streakService.calculateStreaks(logs, frequency, target, habitCreatedAt)

Returns `{ currentStreak, longestStreak }`.

**Algorithm:**

1. Build a `completedSet` (Set of YYYY-MM-DD strings) from logs where:
   - Boolean habits: `value === true`
   - Count habits: `value >= target`
2. Determine `startDate`: habit creation date, or earliest log date if backdated logs exist
3. Build `scheduledDates`: all dates from startDate to today matching the habit's `frequency` (day-of-week)
4. **Longest streak (forward pass):** iterate scheduledDates, count consecutive completions, track max
5. **Current streak (backward pass):** start from latest scheduled date, skip today if not completed (day isn't over), count backwards until a gap

For shared habits, per-user streaks are calculated separately. Only the owner's streaks are persisted on the Habit document.

### cacheService (NodeCache)

- Default TTL: 300 seconds
- Check period: 60 seconds
- **Prefix-based invalidation:** keys like `habits:userId:archived=false` are tracked under prefixes `habits`, `habits:userId`, etc. Calling `delByPrefix("habits:userId")` deletes all matching keys in O(1) via a lookup map.
- Used by `habitService` (TTL 120s) to cache habit lists.

### emailService

Provider abstraction: configured via `EMAIL_PROVIDER` env var.

| Provider | Env Vars Required |
|----------|------------------|
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Resend | `RESEND_API_KEY` |
| Brevo | `BREVO_API_KEY` |

Falls back to console logging if no provider is configured.

**Email types sent:**
- Welcome (on registration)
- Password reset link (30-min expiry)
- Password reset confirmation
- Password changed notification
- Shared habit invitation (with join link)
- Feedback admin notification

All email sends are fire-and-forget (`.catch()` to prevent request failures).

### exportService

**Excel (`generateExcel`)** — 3 sheets:
1. **Summary:** habit metadata, completion %, streaks. Conditional formatting: green >= 75%, yellow >= 50%, red < 50%
2. **Daily Log:** date, day, week#, habit, value, completed, notes. Auto-filter enabled
3. **Weekly View:** date columns per habit with checkmarks/values. Week separators

**PDF (`generatePDF`)** — sections:
1. **Cover page:** date range, 4 stat boxes (total habits, completion %, best habit, best day)
2. **Category pages:** habits grouped by category with accent color bars, completion rates, streaks
3. **Daily grid:** abbreviated habit names, symbols (checkmark/cross/values), alternating row backgrounds

Both exports include owned and shared habits.

### logService

Key behaviors:
- `createOrUpdate`: uses `findOneAndUpdate` with upsert (atomic create-or-update)
- Validates: date <= today, date >= (today - 7 days), date >= habit creation date
- Shared habit authorization: owner, admin, or member can log; viewers cannot
- After logging, `updateStreaks()` is called asynchronously (errors caught, don't fail the request)
- `getDailyLogs`: 3-phase parallel query for optimal performance
- `getYearlyLogs`: MongoDB aggregation pipeline for monthly stats

---

## 5. Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Weekly Summary | `0 9 * * 0` (Sunday 9 AM UTC) | Sends push notification with weekly completion stats to all subscribed users |

Implemented via `node-cron`. Jobs are started in `server/src/index.js` after DB connection.

---

## 6. Frontend Architecture

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

Protected routes use `<ProtectedRoute>` which checks `useAuth()` and redirects to `/login` with saved location state.

### Component Tree

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

### Context Providers

**AuthContext** — `useAuth()`:
- State: `user`, `loading`
- Methods: `login()`, `register()`, `logout()`, `updateUser()`
- Persistence: `token` and `user` in localStorage
- On 401 response: clears localStorage, redirects to `/login` (via axios response interceptor)

**ThemeContext** — `useTheme()`:
- State: `theme` (user preference), `resolvedTheme` (computed)
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` for system theme
- Applies `dark` class to `<html>` element
- Persistence: `theme` in localStorage

### API Client (Axios)

- Base URL: `import.meta.env.VITE_API_URL` or `/api`
- **Request interceptor:** injects `Authorization: Bearer <token>` from localStorage
- **Response interceptor:** on 401, clears auth state and redirects to `/login` (skips if already on auth pages)

### PWA Configuration

```
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  manifest: {
    name: 'Habit Tracker',
    short_name: 'Habits',
    display: 'standalone',
    theme_color: '#6366f1',
    icons: [192x192, 512x512, 512x512 maskable]
  }
})
```

**Service Worker (`sw.js`):**
- `install`: `self.skipWaiting()` — activate immediately
- `activate`: `clients.claim()` — control all pages
- `push`: displays notification with icon, badge, and tag
- `notificationclick`: navigates to URL from notification data

### Date Handling

- **Client:** dates are YYYY-MM-DD strings in local timezone (`getLocalDateString()`)
- **Server:** dates stored as UTC midnight (`toUTCMidnight()`)
- **Timezone:** auto-detected on login via `Intl.DateTimeFormat().resolvedOptions().timeZone`, saved to user settings

---

## 7. Input Validation

All validators use `express-validator` and are applied at the route level before controllers.

### Auth
- `name`: required, max 100
- `email`: required, valid format, normalized
- `password`: required, min 6
- `resetToken`: required, hex, length 64

### Habits
- `name`: required, max 100
- `type`: enum (boolean, count)
- `color`: hex format (#RRGGBB)
- `target`: integer >= 1
- `frequency`: array of 1+, each 0–6
- `category`: enum
- `reorder.items[]`: id (MongoId) + sortOrder (int >= 0)

### Logs
- `habitId`: required, MongoId
- `date`: required, YYYY-MM-DD
- `value`: required, boolean or non-negative number
- `notes`: optional, max 500

### Shared Habits
- `inviteCode`: required, alphanumeric
- `email`: required, valid, normalized
- `role`: enum (admin, member, viewer)
- `accept`: required, boolean

### Export
- `start`, `end`: required, YYYY-MM-DD

---

## 8. Error Handling

### Global Error Handler

Catches all errors and returns consistent JSON responses:

| Error Type | Status | Handling |
|-----------|--------|---------|
| Mongoose duplicate key (11000) | 400 | Extracts field name |
| Mongoose validation error | 400 | Combines all error messages |
| MongoDB CastError (invalid ObjectId) | 400 | "Invalid {path}" |
| JsonWebTokenError | 401 | "Invalid token" |
| TokenExpiredError | 401 | "Token expired" |
| AppError (custom) | custom | Uses provided statusCode |
| Unknown | 500 | "Internal server error" |

In development, error responses include the stack trace.

### Client-Side

- `ErrorBoundary` component catches React render errors with fallback UI
- Toast notifications (`react-hot-toast`) for user-facing errors and success messages
- `NotFoundPage` for unmatched routes

---

## 9. Deployment

### Vercel

Both client and server are deployed on Vercel.

**Client (`client/vercel.json`):**
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
SPA routing — all paths serve `index.html` for React Router.

### Environment Variables

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
| `EMAIL_PROVIDER` | smtp | Email provider (smtp/resend/brevo) |
| `EMAIL_FROM` | Habit Tracker \<noreply@...> | Sender address |
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

### Database Indexes

On startup, `connectDB()` syncs indexes on HabitLog and SharedHabit collections (drops stale, creates missing).

---

## 10. Testing

### Setup

- **Framework:** Jest with ES modules (`--experimental-vm-modules`)
- **Mocking:** `jest.unstable_mockModule` for ESM dynamic imports
- **Pattern:** mock dependencies → import module under test

### Test Structure

```
server/src/__tests__/
├── controllers/     # 8 files — all route handlers
├── middleware/       # 6 files — auth, authorize, error, rate limit, upload, validate
├── services/        # 10 files — auth, cache, email, export, habit, log, push, shared, streak, user
├── jobs/            # 1 file — weekly summary cron
├── utils/           # 4 files — AppError, catchAsync, dateHelpers, responseFormatter
└── validators/      # 5 files + helpers — auth, export, habit, log, sharedHabit
```

### Coverage Thresholds

| Module | Branches | Functions | Lines | Statements |
|--------|:--------:|:---------:|:-----:|:----------:|
| Utils | 100% | 100% | 100% | 100% |
| Controllers | 100% | 100% | 100% | 100% |
| Middleware | 90% | 100% | 100% | 100% |
| Core services* | 100% | 100% | 100% | 100% |

*authService, cacheService, habitService, streakService, userService

### Running Tests

```bash
cd server
npx jest                    # run all tests
npx jest --watchAll         # watch mode
npx jest --coverage         # with coverage report
```

---

## 11. Project Structure

```
habit-tracker-claud/
├── client/
│   ├── public/              # Static assets, PWA icons, sw.js
│   ├── src/
│   │   ├── api/             # Axios instance + 7 API modules
│   │   ├── components/
│   │   │   ├── analytics/   # Charts, heatmaps, export UI
│   │   │   ├── auth/        # Login, register, password pages
│   │   │   ├── dashboard/   # TodayView, progress, streaks
│   │   │   ├── feedback/    # Feedback modal and button
│   │   │   ├── habits/      # HabitCard, HabitForm, templates, pickers
│   │   │   ├── layout/      # AppLayout, Sidebar, Header
│   │   │   ├── shared/      # SharedHabitsPage, JoinSharedHabit
│   │   │   ├── settings/    # Profile, theme, notifications, password
│   │   │   ├── ui/          # Button, Card, Modal, EmptyState, Spinner
│   │   │   └── views/       # WeeklyView, MonthlyGridView
│   │   ├── config/          # Category defaults
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── services/        # Push notification client
│   │   └── utils/           # Date helpers
│   ├── vite.config.js
│   └── vercel.json
├── server/
│   ├── src/
│   │   ├── config/          # env, constants, db, cloudinary, swagger
│   │   ├── controllers/     # 8 route handlers
│   │   ├── middleware/      # auth, authorize, error, rate limit, upload, validate
│   │   ├── models/          # 6 Mongoose schemas
│   │   ├── routes/          # 8 route files + index
│   │   ├── services/        # 11 business logic modules
│   │   ├── validators/      # 5 validation rule sets
│   │   ├── jobs/            # Cron jobs
│   │   ├── utils/           # AppError, catchAsync, dateHelpers, responseFormatter
│   │   └── __tests__/       # Jest tests (34 files)
│   ├── jest.config.js
│   └── package.json
├── package.json             # Workspace root
└── vercel.json
```

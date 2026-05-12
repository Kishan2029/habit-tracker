# CLAUDE.md — Client (React + Vite PWA)

Scope: everything under `client/`. For repo-wide rules see `../CLAUDE.md`.

## Stack

- **React 19** with Hooks (no class components)
- **Vite 6** + `@vitejs/plugin-react`
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` — v4 is zero-config; arbitrary values and dark-mode classes work out of the box)
- **React Router 7** (`react-router-dom`)
- **Axios** for HTTP
- **react-hot-toast** for toasts
- **Recharts** for analytics charts
- **@dnd-kit** for drag-and-drop habit reordering
- **canvas-confetti** for the all-done celebration
- **vite-plugin-pwa** with `injectManifest` strategy — service worker is `src/sw.js`

ES modules, JSX, no TypeScript. Dev server on port 5173, proxies `/api` to `http://localhost:5000` (see `vite.config.js`).

## Folder layout

```
client/src/
├── App.jsx               root component with routes + providers
├── main.jsx              entry — mounts App, do NOT register sw.js here
├── sw.js                 custom service worker (push handler + cache)
├── index.css             global Tailwind directives
├── api/                  one file per backend resource — thin axios wrappers
├── components/
│   ├── analytics/        charts, heatmaps, reports (lazy-loaded)
│   ├── auth/             login, register, forgot/reset password, ProtectedRoute
│   ├── dashboard/        TodayView and its widgets
│   ├── feedback/         feedback modal + button
│   ├── habits/           habit cards, form, picker components, share modal
│   ├── layout/           AppLayout, Header, Sidebar
│   ├── settings/         profile, password, avatar, theme, notifications
│   ├── shared/           shared-habits list, join page, leaderboard
│   ├── ui/               reusable primitives (Button, Card, Modal, …)
│   └── views/            WeeklyView, MonthlyGridView (lazy-loaded)
├── config/               static config (categories, habitTemplates)
├── context/              AuthContext, ThemeContext
├── hooks/                custom hooks (currently empty — add here, not in components/)
├── services/             non-HTTP side effects (e.g. pushNotification.js)
└── utils/                date helpers, useToday hook
```

**Where does a new component go?** Match the domain:
- A new analytics chart → `components/analytics/`
- A new habit-editing widget → `components/habits/`
- Something reusable across domains (button, card, modal) → `components/ui/`
- A new top-level page → its own domain folder, then wire into `App.jsx`

## State management

**Context API only.** Two providers wrap the app in `App.jsx`:

- `AuthContext` (`context/AuthContext.jsx`) — current `user`, `login`, `register`, `logout`, `updateUser`. Token + user are persisted to `localStorage`. On login, browser timezone is auto-detected (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and patched onto the user. Consume via `useAuth()`.
- `ThemeContext` — light / dark / system, with `system` resolved against `prefers-color-scheme`.

Use `useState` / `useReducer` for local component state. **Don't add Redux, Zustand, Jotai, or Recoil.** If shared state grows beyond auth/theme, add a new Context — don't reach for a library.

Server data is fetched per-component with `useEffect` + an `api/*` call. There is no global cache (no React Query / SWR). If you find yourself refetching the same data in multiple components, lift the fetch to a parent or a context.

## API layer

Every backend resource has a matching module under `src/api/`:

```
api/
├── axios.js          shared axios instance — DO NOT import axios directly elsewhere
├── authApi.js        /auth/*
├── userApi.js        /users/*
├── habitApi.js       /habits/*
├── logApi.js         /logs/*
├── sharedHabitApi.js /shared/*
├── exportApi.js      /export/*
└── feedbackApi.js    /feedback/*
```

Rules:

1. **Always import from `./axios.js`** — it attaches the JWT, sets a 15s timeout, and redirects to `/login` on 401 (unless you're already on an auth page).
2. **Functions return the raw axios promise.** Callers destructure `{ data }` and read `data.data.<resource>`. Example:
   ```js
   const { data } = await getHabits();
   setHabits(data.data.habits);
   ```
3. **Adding a new backend endpoint?** Add a matching function to the right `*Api.js` file. If it's a brand new resource, create a new `*Api.js` module — don't dump it into the closest existing one.
4. **Error handling:** let axios errors bubble. Use `try/catch` in the component and surface via `toast.error()`. The 401 interceptor handles session expiry centrally.

## Routing

All routes are declared in `App.jsx`. Public routes (login, register, forgot/reset password, `/join/:inviteCode` preview) are outside `<ProtectedRoute>`. Authenticated routes are wrapped in `<ProtectedRoute>` → `<AppLayout>`.

Heavy routes are **lazy-loaded** with `React.lazy` + `<Suspense>`: `AnalyticsPage`, `SettingsPage`, `WeeklyView`, `SharedHabitsPage`, `JoinSharedHabit`. Keep this pattern for any new analytics-heavy or rarely-visited page.

`/` redirects to `/today`. `*` falls through to `NotFoundPage`.

## Styling

- **Tailwind v4 utility classes only.** No custom CSS files beyond `index.css` (which only has Tailwind directives).
- **Dark mode** uses `dark:` variants. The `ThemeContext` toggles a class on `<html>`.
- **Color palette** — habit cards use the habit's own `color` (hex) inline via `style={{ backgroundColor: ... }}`. Category colors come from `config/categories.js` via `getCategoryConfig(category)`. Don't hard-code category colors in components.
- **Brand color** is `#6366f1` (indigo) — used in PWA theme, defaults, focus rings.

## Dates and timezones

This is the easiest thing to get wrong in this codebase. **Rules:**

- API params and stored log dates are **`YYYY-MM-DD` strings in the user's local timezone**.
- Never call `.toISOString().split('T')[0]` — it shifts the date in non-UTC timezones.
- Use the helpers in `utils/dateUtils.js`:
  - `getLocalDateString(date)` — `YYYY-MM-DD` in local time
  - `shiftDate(str, days)` — add/subtract days without drift
  - `parseLocalDate(str)` — back to `Date` at local midnight
- Habit-specific date math (scheduled-day checks, etc.) lives in `utils/habitDateUtils.js`. Use it; don't reimplement `frequency` array checks inline.
- `utils/useToday.js` is a hook that returns today's date string and re-renders across midnight.

## PWA / service worker

- `src/sw.js` is the custom service worker (push notifications + offline cache). `vite-plugin-pwa` injects the precache manifest at build time (`injectManifest` strategy).
- **Do not call `navigator.serviceWorker.register('/sw.js')` from `main.jsx`** — the plugin handles registration. Duplicate registration causes SW conflicts.
- Push subscription logic lives in `services/pushNotification.js`. VAPID public key comes from `import.meta.env.VITE_VAPID_PUBLIC_KEY`.
- PWA manifest (icons, name, theme color) is in `vite.config.js`, not a separate file.

## Conventions

- **File naming:** PascalCase for components (`HabitCard.jsx`), camelCase for everything else (`habitApi.js`, `dateUtils.js`). Default export for components, named exports for API/util modules.
- **Hooks** start with `use`. Custom hooks go in `src/hooks/` (currently empty — populate it instead of inlining hook factories in components).
- **Toasts** via `react-hot-toast` — `toast.success(...)`, `toast.error(...)`. The `<Toaster>` is mounted once in `App.jsx`.
- **Confetti** is fire-and-forget via `canvas-confetti`. Only trigger on active user action (logging the last habit), never on page load.
- **ESLint** runs via `npm run lint` — config in `eslint.config.js`. The `react-hooks` and `react-refresh` plugins are enforced; don't disable them locally.
- **localStorage** is used for: `token`, `user`, theme preference, category collapse state. That's it — don't add more without a reason. Service-side state lives on the server.

## Adding a frontend feature — checklist

1. If new backend endpoints exist, add functions to the matching `src/api/*.js` file.
2. Build components under the right `components/<domain>/` folder. Reuse `components/ui/` primitives (`Button`, `Card`, `Modal`, `LoadingSpinner`, `EmptyState`, `ErrorBoundary`).
3. If it's a new page, add a `<Route>` in `App.jsx` — wrap in `ProtectedRoute` if it requires auth, and consider `React.lazy` if it's heavy.
4. If it needs auth/user data, use `useAuth()`. For theme, use `useTheme()`.
5. For dates, use `utils/dateUtils.js`. For habit scheduling math, use `utils/habitDateUtils.js`.
6. Surface success/error with `toast.*`. Wrap risky UI in `ErrorBoundary` if isolation matters.
7. Run `npm run lint` and `npm run build` before considering it done.

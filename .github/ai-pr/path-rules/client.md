# Client Path Rules

Applied to any file matching `client/**`.

## Component structure

- Components live under `client/src/components/<domain>/`. Pick an existing domain folder; create a new one only when none fits.
- UI primitives (`Button`, `Card`, `Modal`, `LoadingSpinner`, `EmptyState`) live in `client/src/components/ui/`. Reuse them; don't duplicate.
- API modules live in `client/src/api/<resource>Api.js`. One named export per endpoint.

## Specific checks

- Every component that makes an API call must handle loading and error states.
- `useAuth()` for the current user, `useTheme()` for theme — don't read these from props when context hooks exist.
- `utils/dateUtils.js` for all date formatting (`getLocalDateString`, `shiftDate`, `parseLocalDate`). Never `new Date().toISOString()` at render time.
- `utils/habitDateUtils.js` for scheduling math (due-date logic, streak calculation).
- New pages must be wrapped in `<ProtectedRoute>` in `App.jsx` and loaded via `React.lazy` if they're heavy (match the analytics/settings pattern).
- Tailwind tokens only — no inline `style={{ color: '#hex' }}`.
- No direct `import axios from 'axios'` — use `import api from '../api/axios.js'`.
- The Vite PWA plugin manages `/sw.js` registration. Never call `navigator.serviceWorker.register()` manually.
- Dark mode: any change to a color or background class must be verified in both light and dark variants (`dark:` prefix).

# ADR 0001: Context API instead of Redux/Zustand for state

Date: 2026-05-12
Status: Accepted

## Context

This is a single-user habit tracking app. The state that truly needs to be shared across the component tree is small: the authenticated user and the active theme. Other domain state (habits, logs, analytics data) is fetched per page and doesn't need a long-lived global cache.

A heavier state library (Redux Toolkit, Zustand, Jotai, Recoil) would add bundle weight, install surface area, and a second mental model on top of React's built-in primitives. A server-cache library (React Query, SWR) would help with stale-while-revalidate semantics but isn't load-bearing for current UX — most reads are visit-once-per-session.

## Decision

Use React Context for cross-tree state only where it's actually needed:

- `AuthContext` for the authenticated user, login/register/logout, and timezone detection.
- `ThemeContext` for the resolved light/dark theme.

Everything else uses local `useState` / `useReducer`. Server data is fetched per component with `useEffect` + the `src/api/*` modules. No shared cache layer.

## Consequences

**Good**
- Zero extra dependencies for state.
- New contributors don't need to learn Redux/RTK patterns.
- Auth flow stays simple: token + user in `localStorage`, axios interceptor handles 401.

**Bad**
- Re-renders are coarse — any `AuthContext` change re-renders every consumer. Acceptable because the context value changes rarely (login, logout, profile update).
- No server-cache means components occasionally refetch the same data when navigating. Acceptable for the current scale; if it becomes a problem, the answer is to lift the fetch into a parent or a new context, not to install React Query.

## Alternatives considered

- **Redux Toolkit** — overkill for two pieces of state, and `redux-persist` is a heavy way to do what `localStorage` does in five lines.
- **Zustand** — lighter, but still adds a dependency and a second mental model. Not justified at current scope.
- **React Query / SWR** — would help if we had complex cache-invalidation needs, but right now the server's `node-cache` plus per-component fetches is sufficient.

## Trigger to revisit

If we add real-time collaboration (more than one user editing the same habit at once), or if more than three independent contexts emerge, reconsider Zustand or React Query.

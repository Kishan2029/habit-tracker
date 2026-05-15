# ADR 0006: Mobile swipe gestures via `react-swipeable`, touch-only, additive

Date: 2026-05-14
Status: Accepted

## Context

The app ships as a PWA and most usage is on mobile, but every interaction was tap-only. We wanted swipe shortcuts on the five highest-traffic surfaces (habit toggle, date nav, analytics tabs, habit row edit/delete, pull-to-refresh) without:

1. Breaking the desktop UX that the app already had.
2. Introducing a heavy gesture stack (no Framer Motion / HammerJS — both pull in animation engines we don't need).
3. Hijacking events the existing components depend on (`@dnd-kit` drag handle, `BooleanToggle` clicks, vertical scroll).

## Decision

- Use **`react-swipeable`** (~3 KB) for swipe detection. It's a tiny hook with no animation runtime — we already do all our visual feedback through Tailwind transitions.
- **Pull-to-refresh is hand-rolled** in `hooks/usePullToRefresh.js`. `react-swipeable` only emits one swipe direction at end-of-gesture; it can't render the progressive pull indicator or honor a threshold mid-drag.
- All gestures are **touch-only**: `useIsTouchDevice()` matches `(hover: none) and (pointer: coarse)`, and every `useSwipeable` call passes `trackMouse: false`. Desktop never sees gesture handlers at all.
- Gestures are **additive**, not a replacement. The Habits page still shows the four inline action buttons; swipe-to-reveal is a shortcut. The Today view still shows `BooleanToggle` / `CountStepper`; swipe-to-complete is a shortcut. This keeps every action discoverable for new users and accessible to assistive tech.
- Swipe handlers live in small dedicated wrappers (`SwipeToToggleRow`, `SwipeableHabitRow`) under the matching domain folder. Per-row `useSwipeable` calls happen inside a component so React's rules-of-hooks hold across list re-renders.

## Consequences

**Good:**
- 3 KB of JS, no animation lib, no gesture conflicts with `@dnd-kit` (which uses pointer events on a separate handle).
- Desktop pixel-perfect identical to before (gesture code paths short-circuit on non-touch).
- Each surface keeps its existing keyboard / click affordances — no regression for screen readers.

**Bad:**
- Touch detection uses media queries, not feature detection. A Surface-style hybrid laptop reports `pointer: coarse` when used as a tablet but `pointer: fine` when docked; we accept this as a media-query boundary, not a per-event one.
- `react-swipeable` doesn't expose `stopPropagation`, so we have to keep horizontal-swipe regions DOM-disjoint. The Today view puts date-swipe on `DateNavigator` only and toggle-swipe on each habit card; no parent of those handles horizontal swipes.

## Alternatives considered

- **Framer Motion `drag` + variants** — gives us free animation but pulls in ~30 KB and we'd use 5% of its API. Rejected for weight.
- **Hand-rolled `pointerdown/move/up` on every surface** — what `usePullToRefresh` does. Fine for one surface, but five surfaces would mean five copies of the same boilerplate. Rejected for duplication.
- **Replace inline buttons with gesture-only UI** — clean but inaccessible. Rejected; gestures are additive.
- **Enable `trackMouse`** — would let us test on desktop without a touch screen, but firing a swipe during text selection or accidental drag would be a major bug. Rejected.

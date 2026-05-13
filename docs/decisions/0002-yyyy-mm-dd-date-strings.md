# ADR 0002: Dates as YYYY-MM-DD strings in local timezone at app boundaries

Date: 2026-05-12
Status: Accepted

## Context

A habit tracker lives or dies by date correctness. "Did I complete this habit yesterday?" is the central question, and "yesterday" depends on the user's local timezone, not UTC.

The most common JavaScript timezone bug is `date.toISOString().split('T')[0]` — that converts to UTC first, which silently shifts the date for any user east of UTC after their local midnight or west of UTC before their local midnight. We hit this bug early on. The fix is to choose a single representation at the API boundary and never touch UTC for display-layer dates.

## Decision

At every app boundary — API query/path/body params, log dates, freeze dates, export ranges — represent dates as `YYYY-MM-DD` strings interpreted in the **user's local timezone**.

- **Client**: `client/src/utils/dateUtils.js` provides `getLocalDateString(date)`, `shiftDate(str, days)`, `parseLocalDate(str)`. These are the only sanctioned ways to produce or manipulate date strings. They never round-trip through UTC.
- **Server**: stores log `date` as UTC midnight in MongoDB, but accepts and emits `YYYY-MM-DD` strings. Conversions happen in `server/src/utils/dateHelpers.js`.
- **User timezone**: detected on login via `Intl.DateTimeFormat().resolvedOptions().timeZone`, persisted to `user.settings.timezone`, used by server-side jobs (daily reminders, missed alerts) for "what is today for this user."

## Consequences

**Good**
- No timezone drift for users in any zone.
- Date strings are sortable, comparable, and human-readable.
- Calendar / heatmap rendering is straightforward — group by the string directly.

**Bad**
- The same `Date` object can produce different YYYY-MM-DD strings on different machines. Don't pass `Date` instances across the boundary; pass strings.
- Daylight saving transitions still require care for "1 day ago" math at the edges. The `shiftDate` helper uses local-date arithmetic to avoid this.

## Alternatives considered

- **UTC everywhere with timezone conversion at display time** — works for global apps but requires every UI component to know the user's timezone, and the bug surface is high.
- **Store millisecond timestamps, format at the edge** — same problem in a different shape; still needs a "what day is this" decision and a timezone lookup.

## Trigger to revisit

If we add features that need sub-day precision (e.g. "log this at 3pm exactly"), we'll need to extend the model to include a timestamp alongside the date string, not replace it.

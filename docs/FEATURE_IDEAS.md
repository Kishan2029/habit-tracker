# Feature Ideas

The backlog of candidate features for this habit tracker. Each entry is a lightweight brief — enough to remember the idea and reason about scope, not a full spec. When something graduates to "next up", consider promoting it to a longer spec under `docs/features/<slug>.md` and updating its status here.

## How to use this file

- **Adding an idea** — pick the right theme, add a new entry following the format below. Status starts as `Proposed`.
- **Picking one to build** — change status to `Planned`. Read `FEATURE_FLOW.md` and start at Phase 0.
- **Shipping one** — change status to `Shipped`. Don't delete the entry; the history is useful.
- **Rejecting one** — change status to `Rejected` with a one-line reason. Don't delete; the reasoning matters next time someone proposes it.

### Status legend

`Proposed` — captured, not yet decided.
`Planned` — committed for an upcoming cycle.
`In progress` — branch open, work started.
`Shipped` — merged to `main`.
`Rejected` — explicitly decided against.

### Effort legend

`S` — under a day.
`M` — 1–3 days.
`L` — multi-week or unclear; needs a spec before estimating.

### Entry format

```
### <name>

- Status: <status>
- Theme: <theme>
- Effort: <S | M | L>
- Summary: <one or two lines>
- Surface: <models / files / endpoints affected>
- Tradeoffs: <one line>
- Depends on: <other entries that should ship first, or — if none>
```

---

## Recommendations (start here)

- **Depth pick:** `Duration habits` — unblocks correlation analysis with duration data, smart reminder timing, and the gym/meditation user segment. Cleanest schema expansion in the backlog.
- **Fast win:** ship `Habit duplication`, `Vacation mode`, and `Mobile swipe gestures` in one branch. About half a day of work; users notice immediately.

---

## Theme 1 — Make the data say more

### Habit correlations

- Status: In progress (branch `feat/habit-insights`)
- Theme: Insights
- Effort: M
- Summary: For each habit pair, show "when you complete A, you complete B X% of the time vs Y% baseline." Surfaces hidden relationships in the data the user already has.
- Surface: New `correlationService`; new endpoint `GET /api/logs/insights?days=60`; new `InsightsView.jsx` as a new tab in `AnalyticsPage`. No schema change.
- Tradeoffs: Statistically noisy for users with sparse data — guards (14 overlap days, 5 in each group, 15pp lift) filter out unreliable pairs. Won't render anything useful for new users.
- Depends on: —
- Decisions (from Phase 2 discussion):
  - Same-day correlation only (lagged is a follow-up).
  - Show both positive ("boosters") and negative ("trade-offs") in one view.
  - Fixed 60-day window for MVP — selector is a fast follow.
  - Tab name: "Insights".
  - Conditional probability `P(B | A)` vs `P(B | ¬A)`, not Pearson/phi — easier to explain in the UI.
  - Thresholds tunable via constants, not ADR'd.

### Time-of-day patterns

- Status: Proposed
- Theme: Insights
- Effort: M
- Summary: "You usually complete 'read' between 9–10pm." Powers smart reminders later.
- Surface: Add `loggedAt: Date` to `HabitLog` (additive, no migration); new aggregation; new analytics widget.
- Tradeoffs: Only meaningful after a few weeks of data per habit.
- Depends on: —

### Personal weekly review

- Status: Proposed
- Theme: Insights / Behavior
- Effort: M
- Summary: Weekly email/page that asks 2–3 reflection prompts and stores the answers as a journal entry. Sits alongside the existing weekly summary.
- Surface: New `Reflection` model `(userId, weekOf, prompts[], answers[])`; new endpoints `POST/GET /api/reflections`; new page in `components/analytics/`. Wire into the weekly cron.
- Tradeoffs: Genuine behavior-change feature, but adoption depends on prompt quality and reminder cadence.
- Depends on: —

---

## Theme 2 — Make the habit model richer

### Duration habits

- Status: Proposed
- Theme: Habit model
- Effort: M
- Summary: New `type: 'duration'` — start a timer in-app, log automatically when it ends or the user stops. "Meditate 10 min", "Read 30 min".
- Surface: `Habit.type` enum gains `duration`; constants update; validators allow `targetMinutes`; new timer UI under `components/dashboard/` or `components/habits/`; service worker keeps the timer running when tab is backgrounded.
- Tradeoffs: Streak calculator needs a branch for the new type. Export/PDF/Excel needs new columns. Worth doing carefully because it unblocks several other features.
- Depends on: —

### Sub-habits / checklists

- Status: Proposed
- Theme: Habit model
- Effort: L
- Summary: A habit like "morning routine" that's really N sub-items. Either parent habit with child boolean checks, or a single habit with a `steps[]` array.
- Surface: New schema decision (parent/child vs embedded steps) → write an ADR before code. Many UI knock-on effects (cards, weekly view, analytics).
- Tradeoffs: High schema/UI surface area for what some users see as cosmetic.
- Depends on: ADR drafted first.

### Mood / rating habits

- Status: Proposed
- Theme: Habit model
- Effort: S
- Summary: New `type: 'rating'` with a 1–5 scale.
- Surface: `Habit.type` enum + constants; validators; new logging UI; analytics gets a "mood over time" line chart for free.
- Tradeoffs: Pairs well with `Habit correlations` — adds a non-binary axis to correlate against.
- Depends on: —

### Habit stacking

- Status: Proposed
- Theme: Habit model / Behavior
- Effort: S
- Summary: "After I do X, I do Y" — a soft link between two habits that surfaces the second as a suggestion when the first is logged.
- Surface: `Habit.linkedHabitId: ObjectId` (optional); UI prompt on successful log; minor analytics ("X → Y completion rate").
- Tradeoffs: Easy to add, easy to abuse — users may daisy-chain everything. Cap to one link per habit.
- Depends on: —

---

## Theme 3 — Polish for daily use

### Mobile swipe gestures

- Status: Proposed
- Theme: Polish
- Effort: S
- Summary: Swipe-right on a habit card to log, swipe-left to skip / freeze.
- Surface: Client-only. Reuse `@dnd-kit` touch handlers or a small dedicated lib.
- Tradeoffs: Must not conflict with the existing drag-to-reorder gesture. Use long-press for reorder, short-swipe for log.
- Depends on: —

### Bulk log editing

- Status: Proposed
- Theme: Polish
- Effort: M
- Summary: One screen to fill in / correct logs for a single habit across N past days at once.
- Surface: New page or modal under `components/habits/`; new endpoint `PUT /api/logs/bulk` that accepts an array of `{habitId, date, value, notes}`. Honors the existing 7-day backdate rule.
- Tradeoffs: Streak recalculation runs once at the end, not per-row.
- Depends on: —

### Habit duplication

- Status: Proposed
- Theme: Polish
- Effort: S
- Summary: One-click "make another habit just like this one." Copies everything except logs.
- Surface: `POST /api/habits/:id/duplicate` → service method that copies allowed fields and creates a new habit; UI button on `HabitCard`.
- Tradeoffs: None notable.
- Depends on: —

### Vacation / pause mode

- Status: Proposed
- Theme: Polish
- Effort: S
- Summary: Pause a habit for N days without affecting streak — longer-lasting than `StreakFreeze`.
- Surface: `Habit.pausedUntil: String` (YYYY-MM-DD); streak calculator treats paused dates as unscheduled; UI toggle + date picker.
- Tradeoffs: Need to clarify "what happens to scheduled-but-paused days in analytics" — probably show as a distinct visual state.
- Depends on: —

### Notes search

- Status: Proposed
- Theme: Polish
- Effort: S
- Summary: Full-text search across log notes — "find everywhere I mentioned 'sore knee'".
- Surface: Mongo text index on `HabitLog.notes`; new endpoint `GET /api/logs/search?q=...`; search bar in `AnalyticsPage` or a new "Journal" tab.
- Tradeoffs: Becomes useful only after a few months of data.
- Depends on: —

---

## Theme 4 — Integrations & data portability

### Apple Health / Google Fit sync

- Status: Proposed
- Theme: Integrations
- Effort: L
- Summary: For exercise / sleep / steps habits, auto-complete based on health data instead of manual tap.
- Surface: Native platform bridging (Apple HealthKit needs a native shell or a WKWebView wrapper; Google Fit has a web API). New `HabitIntegration` model linking a habit to a metric. New sync job.
- Tradeoffs: Highest value-per-feature in the integrations bucket, also the highest implementation cost. The PWA is the gating constraint — a hybrid wrapper might be needed for iOS.
- Depends on: An ADR on the wrapper strategy.

### Calendar export (iCal)

- Status: Proposed
- Theme: Integrations
- Effort: S
- Summary: Generate a `.ics` of each habit's schedule so users can subscribe in Google Calendar / Apple Calendar.
- Surface: New endpoint `GET /api/export/ical?habitId=...` returning an `.ics` body; user gets a subscribe URL in settings.
- Tradeoffs: Read-only and timezone-aware — reuse the same per-user timezone the rest of the app uses.
- Depends on: —

### Public API tokens

- Status: Proposed
- Theme: Integrations
- Effort: M
- Summary: Let users generate a personal access token and hit `POST /api/logs` from a script, shortcut, or Zapier.
- Surface: New `PersonalAccessToken` model `(userId, tokenHash, name, lastUsedAt, scopes)`. New middleware that accepts tokens *or* JWTs. Settings UI to create / revoke.
- Tradeoffs: Adds an auth surface — make sure rate-limiting applies and scopes are minimal by default.
- Depends on: —

### Account JSON export (GDPR-style)

- Status: Proposed
- Theme: Integrations / Compliance
- Effort: S
- Summary: One endpoint that returns everything a user owns as one JSON file.
- Surface: `GET /api/users/me/export` — aggregates User + Habits + Logs + SharedHabit + StreakFreeze + PushSubscription + Feedback into one downloadable JSON. Reuse `exportService`.
- Tradeoffs: Future-proofs against privacy regulations. Cheap to add.
- Depends on: —

---

## Theme 5 — Social / motivation

### Achievements / badges

- Status: Proposed
- Theme: Motivation
- Effort: M
- Summary: "First 30 days completed", "Logged before 8 AM 10 times", "Completed every scheduled day in March." Triggers a toast + persists on the profile.
- Surface: New `Achievement` model and a static `achievements.config.js` describing each. Evaluation runs after every log write. New "Achievements" tab in settings or profile.
- Tradeoffs: Easy to overdo. Cap to ~15 well-chosen achievements rather than dozens of cheap ones.
- Depends on: —

### Public profile (read-only)

- Status: Proposed
- Theme: Motivation
- Effort: M
- Summary: A shareable URL showing the user's habits and current streaks, no auth required to view.
- Surface: Per-user `profileSlug` field; public endpoint `GET /api/public/:slug`; new public page in the client; opt-in toggle in settings.
- Tradeoffs: Adds a public surface — need to be careful with what's exposed (no notes, no log timestamps, just habit names + current streak).
- Depends on: —

### Challenges

- Status: Proposed
- Theme: Motivation / Social
- Effort: L
- Summary: Time-boxed habit goals — "30-day reading challenge" with a join link.
- Surface: New model or extension of `SharedHabit` with `startsAt` / `endsAt`. End-state celebration UI. Email reminders to non-loggers.
- Tradeoffs: Significant moderation / abuse surface if shared publicly. Start with private challenges (invite-only) — same code path, less risk.
- Depends on: A decision on whether challenges build on `SharedHabit` or stand alone.

---

## Deliberately deprioritised

Listed here so they don't keep coming back. Move out only if circumstances change.

### 2FA / OAuth (Google, Apple)

- Status: Rejected (for now)
- Reason: High implementation cost, low marginal benefit for a hobby/personal habit tracker. Reconsider once there are paying users or a credible threat model.

### Geofencing / location-based reminders

- Status: Rejected
- Reason: Battery cost, privacy concerns, complex platform APIs, requires native wrapper. Smart reminders based on `Time-of-day patterns` give 80% of the value at 10% of the cost.

### "AI insights" as a feature label

- Status: Rejected as labelled — accepted as a hidden implementation detail
- Reason: "AI" isn't a feature; it's a tool. Concrete features that might use AI (e.g. generating the weekly review summary from log data) are tracked under their own entry.

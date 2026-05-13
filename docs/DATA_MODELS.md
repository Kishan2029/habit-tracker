# Data Models

Mongoose schemas, fields, indexes, hooks, and relationships. Update this file every time a schema changes — Claude and reviewers read it before reading the model file.

For higher-level architecture see `ARCHITECTURE.md`. For business-rule details on streaks, sharing, and logging see the service descriptions there.

---

## Entity relationships

```
User ──1:N──► Habit ──1:N──► HabitLog
  │              │
  │              └──1:1──► SharedHabit ──► sharedWith[]: { userId, role, status }
  │              │
  │              └──1:N──► StreakFreeze
  │
  ├──1:1──► PushSubscription
  └──1:N──► Feedback
```

---

## User

| Field | Type | Constraints |
|-------|------|-------------|
| name | String | required, trim, max 100 |
| email | String | required, unique, lowercase, trim |
| passwordHash | String | required, **select: false** |
| role | String | enum: `user`, `premium`, `admin` — default `user` |
| settings.theme | String | enum: `light`, `dark`, `system` — default `system` |
| settings.timezone | String | default `UTC` |
| settings.notifications | Mixed | granular toggles per notification type (push + email) |
| avatar.url | String | Cloudinary secure URL |
| avatar.publicId | String | Cloudinary asset ID |
| isEmailVerified | Boolean | default false |
| passwordChangedAt | Date | set on password reset/change |
| resetPasswordToken | String | SHA-256 hash of plaintext token |
| resetPasswordExpires | Date | 30-minute expiry |

**Pre-save hook:** hashes `passwordHash` with bcrypt (12 salt rounds) if modified.

**Methods:**
- `comparePassword(candidate)` — bcrypt compare
- `createPasswordResetToken()` — generates 32-byte hex token, stores SHA-256 hash, returns plaintext
- `toJSON()` — strips `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`

**Gotchas:**
- `passwordHash` is `select: false` — queries that need it must use `.select('+passwordHash')`. Only `authService` should do this.
- Anywhere that resets or changes a password **must** set `passwordChangedAt = new Date()`. The `authenticate` middleware rejects tokens issued before that timestamp.

---

## Habit

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required, indexed |
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
| createdDate | String | optional, YYYY-MM-DD — used when backdating logs places creation earlier than `createdAt` |

**Indexes:**
- `(userId, isArchived)` — list active habits per user
- `(userId, sortOrder)` — ordered list rendering
- `(userId, category)` — category filter

**Notes:**
- Enums come from `server/src/config/constants.js`. Don't redefine them in the schema.
- `currentStreak` / `longestStreak` are denormalized for fast reads. They're recomputed by `streakService.calculateStreaks` after every log write.

---

## HabitLog

| Field | Type | Constraints |
|-------|------|-------------|
| habitId | ObjectId → Habit | required |
| userId | ObjectId → User | required |
| date | Date | required, stored as **UTC midnight** |
| value | Mixed | boolean (for boolean habits) or number (for count habits) |
| notes | String | max 500 |

**Indexes:**
- `(habitId, userId, date)` **UNIQUE** — one log per habit per user per day
- `(userId, date)` — daily/weekly views per user
- `(habitId, date, value)` — analytics queries
- `(userId, habitId)` — per-habit history

**Notes:**
- The API surface is `YYYY-MM-DD` strings (local timezone). The `date` field is the UTC-midnight representation for query consistency. See ADR 0002 (`docs/decisions/0002-yyyy-mm-dd-date-strings.md`).
- `createOrUpdate` in `logService` uses `findOneAndUpdate` with upsert against the unique compound index for atomic create-or-update.

---

## SharedHabit

| Field | Type | Constraints |
|-------|------|-------------|
| habitId | ObjectId → Habit | required, **unique** |
| ownerId | ObjectId → User | required |
| sharedWith | Array | see below |
| inviteCode | String | unique (sparse), 32-char hex |
| isActive | Boolean | default true |

**`sharedWith[]` element:**

| Field | Type | Default |
|-------|------|---------|
| userId | ObjectId → User | — |
| role | String (admin / member / viewer) | `member` |
| status | String (pending / accepted / declined) | `accepted` |
| joinedAt | Date | now |
| invitedBy | ObjectId → User | — |

**Indexes:**
- `(habitId)` **UNIQUE** — one share doc per habit
- `(ownerId)` — "shared by me" list
- `(sharedWith.userId)` — "shared with me" list
- `(inviteCode, isActive)` — invite-code lookup

**Notes:**
- The permission matrix lives in `ARCHITECTURE.md` and is enforced in `sharedHabitService.js`, not middleware.
- Archiving or deleting a Habit fails if `isActive: true`. The owner must `unshare` first.
- `inviteCode` is sparse-unique so unshared habits don't conflict on `null`.

---

## StreakFreeze

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required |
| habitId | ObjectId → Habit | required |
| date | String | YYYY-MM-DD, the date being frozen |
| createdAt | Date | automatic |

**Indexes:** `(userId, habitId, date)` UNIQUE, `(userId, habitId)` for batch status lookups.

**Notes:**
- Frozen days don't count as "missed" in streak calculation — `streakService` treats them as scheduled-but-skipped without breaking the streak.
- Limit per month is enforced in `streakFreezeService` (1–2 per month depending on settings, not on the schema).
- Future dates are rejected at the validator layer (see `freezeDateRule` in `habitRoutes.js`).

---

## PushSubscription

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required, unique |
| subscription.endpoint | String | required |
| subscription.keys.p256dh | String | required |
| subscription.keys.auth | String | required |

**Notes:**
- One subscription per user. If the user re-subscribes from a new browser, the document is upserted.
- Sends use `web-push` with the VAPID keys from `env.vapid`.

---

## Feedback

| Field | Type | Constraints |
|-------|------|-------------|
| userId | ObjectId → User | required |
| mood | String | enum: loved, happy, neutral, confused, sad |
| message | String | trim, max 2000 |
| page | String | trim, max 200 (the route the user submitted from) |
| status | String | enum: open, reviewed, resolved — default `open` |

**Indexes:** `(status, createdAt desc)` — for admin review queue.

**Notes:**
- Rate limited to 5 submissions per hour per IP.
- Submitting also emails `ADMIN_EMAIL` if configured.

---

## Adding a new schema — checklist

1. Create `server/src/models/<Resource>.js`. Use `{ timestamps: true }`.
2. Pull any new enums into `server/src/config/constants.js`.
3. Add compound indexes for every query pattern the service uses. Don't over-index — each index has a write cost.
4. Update this file with the schema's fields, indexes, hooks, and any non-obvious notes.
5. If the model has business invariants beyond shape (e.g. "one share per habit"), add a unique compound index, not a hand-written check in the service.

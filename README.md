# Habit Tracker

A full-stack habit tracking application with analytics, social sharing, and data export capabilities.

**Live App:** Built with React + Express + MongoDB, deployed on Vercel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | Express 5, Node.js (ES Modules) |
| Database | MongoDB with Mongoose |
| Auth | JWT, bcrypt |
| File Storage | Cloudinary |
| Email | SMTP, Resend, Brevo |
| Push Notifications | Web Push (VAPID) |
| Charts | Recharts |
| Export | ExcelJS, PDFKit |
| Testing | Jest |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)

### Environment Variables

Create `server/.env.development` for local development and `server/.env.production` for production:

```env
# Required
MONGODB_URI=mongodb://localhost:27017/habit-tracker
JWT_SECRET=your-secret-key

# Optional
JWT_EXPIRES_IN=7d
PORT=5000
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Email provider
EMAIL_PROVIDER=smtp
EMAIL_FROM=Habit Tracker <noreply@habit-tracker.com>
EMAIL_REPLY_TO=support@habit-tracker.com
EMAIL_REQUEST_TIMEOUT_MS=10000

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# Resend
RESEND_API_KEY=re_xxx

# Brevo
BREVO_API_KEY=your-brevo-api-key

# Cloudinary (for avatars)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Push Notifications
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

### Installation

```bash
# Install all dependencies (client + server)
npm install

# Run both client and server
npm run dev

# Run only server
npm run server

# Run only client
npm run client
```

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

### Running Tests

```bash
cd server
npx jest
```

---

## Product Documentation

### 1. Authentication & Account Management

**Registration & Login**
- Sign up with name, email, and password (min 6 characters)
- Log in with email and password to receive a JWT token
- Rate-limited: 10 registrations / 15 min, 20 logins / 15 min

**Password Recovery**
- Forgot password sends a reset link via email (30-minute expiry)
- Rate-limited: 5 reset requests / 15 min

**Profile Management**
- Update display name, theme preference (light / dark / system), and timezone
- Upload a profile avatar (stored on Cloudinary)
- Change password (requires current password, returns a new JWT token)

---

### 2. Habit Management

**Creating Habits**
- **Name** — up to 100 characters
- **Type** — Boolean (done/not done) or Count (numeric value toward a target)
- **Unit** — label for count habits (e.g., "km", "pages", "minutes")
- **Target** — numeric goal for count habits (default: 1)
- **Color** — custom hex color picker
- **Icon** — emoji selector
- **Frequency** — choose which days of the week (Sun–Sat), defaults to every day
- **Category** — health, fitness, learning, work, mindfulness, social, finance, or other

Each category comes with a default icon and color:

| Category | Icon | Color |
|----------|------|-------|
| Health | :pill: | #10B981 |
| Fitness | :muscle: | #F59E0B |
| Learning | :books: | #6366F1 |
| Work | :briefcase: | #3B82F6 |
| Mindfulness | :person_in_lotus_position: | #8B5CF6 |
| Social | :handshake: | #EC4899 |
| Finance | :moneybag: | #14B8A6 |
| Other | :dart: | #6B7280 |

**Organizing Habits**
- Drag-and-drop to reorder habits
- Archive habits to hide them without deleting
- Unarchive to restore
- Filter by category

---

### 3. Daily Logging & Tracking

**Logging a Habit**
- Toggle completion for boolean habits or enter a numeric value for count habits
- Add optional notes (up to 500 characters) per entry
- Can backdate entries up to 7 days in the past; future dates are blocked

**Today View**
- Shows all habits scheduled for the current day
- Progress bar displaying completed / total habits
- Confetti celebration when all habits are completed
- Navigate between dates with previous / next buttons
- Shared habits display a badge and show member progress

---

### 4. Streak Tracking

- **Current streak** — consecutive days of completion on scheduled days (backward from yesterday or today if completed)
- **Longest streak** — all-time best consecutive completion run
- Streaks respect habit frequency (only scheduled days count)
- Count habits require meeting the target value to count as completed
- Streaks are displayed as badges on habit cards and in the Today view

---

### 5. Views

**Weekly View**
- 7-day grid (Monday–Sunday) with all habits as rows
- Click any cell to log or toggle completion
- Color-coded by habit color
- Only shows days the habit is scheduled for
- Navigate between weeks

**Monthly Grid View**
- Calendar layout showing completion dots for each day
- Color intensity reflects completion percentage
- Click any day to view or edit logs
- Filter by category
- Navigate between months

---

### 6. Analytics & Reporting

**Daily Analytics**
- Completion percentage ring chart (green >= 75%, amber >= 25%, red > 0%)
- Habit-by-habit completion list

**Monthly Analytics**
- Calendar heatmap showing daily completion intensity
- Filter by specific habit

**Yearly Analytics**
- Monthly bar chart showing completion rate trends
- Best streak and top habits by completion percentage
- Per-habit statistics: total logs, completed count, completion rate

---

### 7. Shared Habits & Collaboration

**Sharing a Habit**
- Any habit owner can share their habit, generating a unique invite code
- Others join via the invite code (no login required to preview)
- Email invitations can be sent with role selection

**Roles & Permissions**

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| Edit habit | Yes | | | |
| Delete habit | Yes | | | |
| Invite members | Yes | Yes | | |
| Remove members | Yes | Yes | | |
| Change roles | Yes | | | |
| Log completions | Yes | Yes | Yes | |
| View progress | Yes | Yes | Yes | Yes |
| Transfer ownership | Yes | | | |

**Managing Shared Habits**
- View "Shared with me" and "Shared by me" tabs
- Accept or decline pending invitations
- Owners can regenerate invite codes, update member roles, remove members, or transfer ownership
- Members can leave a shared habit at any time
- Owner can unshare to stop sharing entirely

**Member Progress**
- View each member's completion status for any given date
- Shared badge appears on habits in all views

---

### 8. Data Export

**Excel Export**
- Download `.xlsx` file for any date range
- Includes: habit metadata, daily logs, completion stats, category breakdown

**PDF Export**
- Download a formatted PDF report for any date range
- Includes: calendar grids, weekly summaries, monthly statistics, top habits

Both exports include owned and shared habits.

---

### 9. Notifications

**Push Notifications**
- Browser-based Web Push using VAPID keys
- Subscribe / unsubscribe from settings
- Service Worker integration for background delivery

**Email Notifications**
- Welcome email on registration
- Password reset link and confirmation emails
- Shared habit invitation emails with join links
- HTML-formatted with branded styling

---

### 10. Settings & Preferences

- **Theme** — light, dark, or system (auto-detect)
- **Timezone** — select your timezone for accurate date handling
- **Notifications** — toggle push notifications on/off
- **Profile** — edit name, upload/remove avatar
- **Password** — change with current password verification

---

### 11. Feedback System

- Submit feedback from within the app with a mood selector (loved / happy / neutral / confused / sad)
- Optional message up to 2,000 characters
- Rate-limited: 5 submissions per hour

---

### 12. API Documentation

Swagger UI is available at `/api-docs` on the server for interactive API exploration.

**API Resources:**
- `POST /api/auth/register` | `POST /api/auth/login` | `POST /api/auth/forgot-password` | `POST /api/auth/reset-password`
- `GET/POST /api/habits` | `GET/PUT/DELETE /api/habits/:id` | `PATCH /api/habits/:id/archive` | `PATCH /api/habits/:id/unarchive` | `PUT /api/habits/reorder`
- `POST /api/logs` | `GET /api/logs/daily` | `GET /api/logs/monthly` | `GET /api/logs/yearly` | `GET /api/logs/range` | `GET /api/logs/shared/:habitId/progress`
- `POST /api/shared/share` | `POST /api/shared/join` | `POST /api/shared/invite` | `POST /api/shared/respond` | `GET /api/shared/with-me` | `GET /api/shared/by-me` | `GET /api/shared/pending` | `GET /api/shared/preview/:inviteCode`
- `GET/PUT /api/users/profile` | `PUT /api/users/change-password` | `POST /api/users/profile/avatar`
- `GET /api/export/xlsx` | `GET /api/export/pdf`
- `POST /api/feedback`
- `POST /api/push/subscribe` | `POST /api/push/unsubscribe`

---

## Project Structure

```
habit-tracker-claud/
├── client/                  # React frontend
│   ├── src/
│   │   ├── api/             # API client modules (axios)
│   │   ├── components/
│   │   │   ├── analytics/   # Charts, heatmaps, reports
│   │   │   ├── auth/        # Login, register, password reset
│   │   │   ├── dashboard/   # Today view
│   │   │   ├── habits/      # Habit cards, forms, modals
│   │   │   ├── layout/      # App shell, sidebar, header
│   │   │   ├── shared/      # Shared habits pages
│   │   │   ├── settings/    # User preferences
│   │   │   └── views/       # Weekly, monthly grid views
│   │   ├── context/         # React context (auth, theme)
│   │   └── utils/           # Date helpers, push notifications
│   └── vercel.json
├── server/                  # Express backend
│   ├── src/
│   │   ├── config/          # DB, env, cloudinary, swagger
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # Auth, validation, rate limiting
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic
│   │   ├── validators/      # Input validation rules
│   │   └── __tests__/       # Jest unit tests
│   └── package.json
├── package.json             # Workspace root
└── vercel.json
```

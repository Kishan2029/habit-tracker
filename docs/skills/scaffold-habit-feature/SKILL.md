---
name: scaffold-habit-feature
description: End-to-end scaffolding of a new feature in this habit-tracker repo — Mongoose model, validator rules, service, controller, route with Swagger annotations, server tests, and (optionally) client API module and components. Use when the user says "add a new feature", "scaffold X", "create a new resource", or names a noun that doesn't yet exist as a model.
---

# Scaffold a new habit-tracker feature

This skill encodes the repo's conventions for adding a feature end-to-end. Don't deviate; the layered backend pattern and the test coverage gates make ad-hoc shortcuts costly.

Before any file changes, read the relevant context (don't echo it to the user):

1. `CLAUDE.md` — repo-wide rules
2. `server/CLAUDE.md` — backend layering rules
3. `client/CLAUDE.md` — frontend rules (only needed if the feature has a UI)
4. `docs/ARCHITECTURE.md` §3 (layered backend) and §9 (error handling)
5. `docs/DATA_MODELS.md` — to match the existing schema style
6. `GOTCHAS.md` — to avoid the date / cache / auth traps
7. The `habit` feature as the reference shape: `server/src/models/Habit.js`, `validators/habitValidators.js`, `services/habitService.js`, `controllers/habitController.js`, `routes/habitRoutes.js`

## Step 0 — Confirm the resource

Get a resource name from the user (singular, camelCase, e.g. `streakReward`, `tag`, `note`). If the input is plural or PascalCase, normalize and confirm.

Capture from the user:
- Resource name (singular, camelCase)
- Whether it's user-scoped (`userId` ref) — almost always yes
- The fields the resource has, with types and constraints
- The operations needed (CRUD subset, plus any custom verbs)
- Whether it needs a client UI today, or just an API

## Step 1 — Server scaffolding

Create files in this order. Mirror the `habit` files for shape, comments, and JSDoc style.

### 1a. Model — `server/src/models/<Resource>.js`

- Mongoose schema with `{ timestamps: true }`.
- `userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }` if user-scoped.
- Pull enums into `server/src/config/constants.js` and import them. Never inline enum string lists in the schema.
- Add compound indexes for every query pattern the service will use. The reference: `Habit` has `(userId, isArchived)`, `(userId, sortOrder)`, `(userId, category)`.

### 1b. Validator — `server/src/validators/<resource>Validators.js`

Export rule arrays as `create<Resource>Rules`, `update<Resource>Rules`, etc. Match the `express-validator` chain style of `habitValidators.js`: `.optional().trim().notEmpty().withMessage(...)`.

### 1c. Service — `server/src/services/<resource>Service.js`

- Singleton class: `class <Resource>Service { ... } export default new <Resource>Service();`
- Methods take primitive args (ids, options object) — never `req`/`res`.
- Throw `AppError(message, statusCode)` on business-rule violations.
- If list reads are hot, add caching with a `_invalidateCache(userId)` private method following `habitService` exactly.

### 1d. Controller — `server/src/controllers/<resource>Controller.js`

Each handler:

```js
export const <action> = catchAsync(async (req, res) => {
  const data = await <resource>Service.<method>(...);
  sendSuccess(res, { <resource>: data }, '<Resource> <action>', <201 if create else 200>);
});
```

No `try/catch`. No Mongoose access. No `res.status(...).json(...)`.

### 1e. Route — `server/src/routes/<resource>Routes.js`

- `router.use(authenticate)` at the top if user-scoped.
- Each endpoint: `<idParamRule if path has :id>, <bodyRules>, validate, <handler>`.
- Add `@swagger` JSDoc above every endpoint. Match the format in `habitRoutes.js` (path, tags, security, parameters, requestBody, responses).

### 1f. Register — `server/src/routes/index.js`

Add the mount: `router.use('/<resource>s', <resource>Routes);` and import at top.

### 1g. Tests — `server/src/__tests__/`

- `services/<resource>Service.test.js` — every method, every `AppError` branch, cache invalidation if applicable.
- `controllers/<resource>Controller.test.js` — happy path per handler + one failure (mock the service to throw `AppError`).
- Use `jest.unstable_mockModule` for ESM mocks — see `docs/TESTING.md` for the canonical pattern.
- **Coverage threshold is 100% on services and controllers.** Hit it.

Run `cd server && npm test`. If anything fails, fix before continuing.

## Step 2 — Client scaffolding (skip if API-only)

### 2a. API module — `client/src/api/<resource>Api.js`

One named export per endpoint, returning the raw axios promise. Import the shared `./axios.js`. **Never import `axios` directly.**

### 2b. Components — `client/src/components/<domain>/`

- Pick the right existing domain folder (analytics / auth / dashboard / habits / layout / settings / shared / ui / views). Create a new folder only if no existing one fits — confirm with the user.
- Reuse `components/ui/` primitives: `Button`, `Card`, `Modal`, `LoadingSpinner`, `EmptyState`, `ErrorBoundary`.
- Use `useAuth()` for current user, `useTheme()` for theme.
- For dates, use `utils/dateUtils.js`. For habit scheduling, use `utils/habitDateUtils.js`.

### 2c. Route (if it's a page) — `client/src/App.jsx`

- Wrap in `<ProtectedRoute>` if auth-required.
- Use `React.lazy` if heavy (Recharts, large form trees) — match analytics/settings/shared pattern.

### 2d. Verify — `cd client && npm run lint && npm run build`

Both must pass.

## Step 3 — Context update (mandatory)

Code that passes tests but leaves docs stale is incomplete work. Walk the six-question checklist from `FEATURE_FLOW.md` § Phase 5 and update the relevant files **in the same response**:

| Question | If yes, update |
|----------|----------------|
| Added or changed a Mongoose schema? | `docs/DATA_MODELS.md` — table, indexes, hooks notes |
| Introduced a new pattern or convention? | Relevant `CLAUDE.md` (root / client / server) |
| Made a non-obvious design choice? | New ADR at `docs/decisions/NNNN-<slug>.md` |
| Hit a footgun or fixed a subtle bug? | `GOTCHAS.md` — one terse bullet under the right section |
| Added or changed an env var? | Both `docs/ARCHITECTURE.md` §11 AND `server/src/config/env.js` |
| Added or changed an endpoint? | `@swagger` JSDoc above the route (already required by step 1e) |

Non-negotiable: if the feature touched a schema or made a design choice, **the corresponding doc update must be part of this response**, not deferred.

## Step 4 — Reporting

End with a summary message listing:

- Every **code** file created (full paths)
- Every **code** file modified (with one-line description of the change)
- Every **doc** file created or modified, with which checklist question triggered it
- Test results and final coverage numbers for the new files
- A one-line context-update verdict for each of the six checklist questions (yes + what changed, or no + why not)
- Any judgement calls you made (folder placement, optional features dropped/added)
- Any follow-up work the user should consider (e.g. "you may want to add an index on `(userId, createdAt)` if you'll list-by-recent")

## Anti-patterns to avoid

- Putting business logic in the controller — it goes in the service.
- Querying Mongoose from the controller — go through the service.
- `try/catch` inside `catchAsync` — defeats the global error handler.
- Bare `res.status(...).json(...)` for errors — throw `AppError`.
- Importing `axios` directly on the client — use `src/api/axios.js`.
- Manually registering `sw.js` from React — `vite-plugin-pwa` does it.
- `toISOString().split('T')[0]` for date strings — use the date utils.
- Caching without `_invalidateCache(userId)` on every write — produces stale reads.
- Adding a new env var read outside `server/src/config/env.js`.
- Lowering a coverage threshold in `jest.config.js` to make CI pass.

If any of these come up because the user is asking you to break the pattern, surface it as a question — don't silently violate the convention.

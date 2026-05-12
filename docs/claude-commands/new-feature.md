---
description: Scaffold a new full-stack feature end-to-end (model + validator + service + controller + route + tests, plus client API module).
---

You are scaffolding a new feature in this habit-tracker repo. Follow the conventions in `CLAUDE.md`, `server/CLAUDE.md`, and `client/CLAUDE.md` exactly — do not invent new patterns.

Feature name / resource: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user for the resource name (singular, camelCase, e.g. `streakReward`) before proceeding.

## Server scaffolding

Create these files in order. Mirror the existing `habit` feature as the reference shape.

1. **Model** — `server/src/models/<Resource>.js`
   - Mongoose schema with `{ timestamps: true }`.
   - Add `userId: ObjectId` ref to User if user-scoped, with `index: true`.
   - Pull any enums into `server/src/config/constants.js`.
   - Add compound indexes for the query patterns the feature needs.

2. **Validator** — `server/src/validators/<resource>Validators.js`
   - Export `create<Resource>Rules`, `update<Resource>Rules` etc. as arrays of `express-validator` chains.
   - Use the same `.optional().trim().notEmpty()...withMessage()` style as `habitValidators.js`.

3. **Service** — `server/src/services/<resource>Service.js`
   - Singleton class exported as `export default new <Resource>Service()`.
   - Methods take primitive args (ids, options object) — never `req`/`res`.
   - Throw `AppError(message, statusCode)` on business-rule failures.
   - If list reads are hot, add `cacheService` caching with a private `_invalidateCache(userId)` helper, following `habitService` exactly.

4. **Controller** — `server/src/controllers/<resource>Controller.js`
   - Each handler is `catchAsync(async (req, res) => { ... })`.
   - Call the service, then `sendSuccess(res, { <resource> }, '<Resource> <action>')`.
   - **No `try/catch`, no Mongoose access, no `res.status(...).json(...)`.**

5. **Route** — `server/src/routes/<resource>Routes.js`
   - `router.use(authenticate)` at the top if user-scoped.
   - Wire each endpoint as `<rules>, validate, <handler>`.
   - Add `@swagger` JSDoc above every endpoint — match the format in `habitRoutes.js`.
   - Inline `param('id').isMongoId()` rule for path id params, as in habitRoutes.

6. **Register** — add the mount in `server/src/routes/index.js`.

7. **Tests** — under `server/src/__tests__/`:
   - `services/<resource>Service.test.js` — cover every branch (the coverage threshold is 100% for services in `jest.config.js`).
   - `controllers/<resource>Controller.test.js` — happy path + one failure per handler.
   - Use `jest.unstable_mockModule` for ESM mocks. Match the pattern in existing tests.

Run `cd server && npm test` and confirm green before moving to the client.

## Client scaffolding

8. **API module** — `client/src/api/<resource>Api.js`
   - One named export per endpoint, returning the raw axios promise.
   - Import the shared `./axios.js` instance — **never** import `axios` directly.

9. **Components** — under `client/src/components/<domain>/`
   - Pick the right domain folder. Create a new one only if no existing folder fits.
   - Reuse `components/ui/` primitives (`Button`, `Card`, `Modal`, `LoadingSpinner`, `EmptyState`).
   - Use `useAuth()` for current user, `useTheme()` for theme.
   - For dates, use `utils/dateUtils.js`. For habit scheduling math, use `utils/habitDateUtils.js`.

10. **Route (if it's a page)** — add `<Route>` in `client/src/App.jsx`.
    - Wrap in `<ProtectedRoute>` if auth-required.
    - Use `React.lazy` if heavy (matches analytics/settings/shared pattern).

11. **Lint + build** — `cd client && npm run lint && npm run build`. Confirm both pass.

## Reporting

When done, post a summary listing every file created/modified, the test results, and any places you had to make a judgement call (e.g. which domain folder to use). If you hit a coverage gap, surface it explicitly — don't silently lower the threshold.

If `$ARGUMENTS` looks plural ("streakRewards") or PascalCase ("StreakReward"), normalize to singular camelCase first and confirm with the user.

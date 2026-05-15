# Server Path Rules

Applied to any file matching `server/**`.

## Layer responsibilities

| Layer | Path pattern | Allowed to do |
|-------|-------------|---------------|
| Model | `server/src/models/*.js` | Define Mongoose schema + indexes + hooks. No business logic. |
| Validator | `server/src/validators/*.js` | Express-validator rule arrays only. Export as `<action>Rules`. |
| Service | `server/src/services/*.js` | All business logic. Throw `AppError`. Cache via `cacheService`. |
| Controller | `server/src/controllers/*.js` | Call service → `sendSuccess`/`sendError`. No `try/catch`, no Mongoose. |
| Route | `server/src/routes/*.js` | Wire `rules → validate → handler`. Add `@swagger` JSDoc above every endpoint. |
| Config | `server/src/config/env.js` | Single source of truth for env vars. |

## Specific checks

- Every new model field that will be queried must have an index. Compound queries need compound indexes.
- `select: false` fields need `.select('+field')` to appear in query results — flag any missing selects.
- `_invalidateCache(userId)` must be called in every write path that has a corresponding cache read. Check both the log and habit write paths.
- Aggregation pipelines: `$match` stages must precede `$group` to use indexes efficiently.
- Constants (enums, limits) live in `server/src/config/constants.js` — not hard-coded in models or services.
- New routes must be registered in `server/src/routes/index.js`.
- Test files live in `server/src/__tests__/`. Services have 100% coverage threshold — never regress it.

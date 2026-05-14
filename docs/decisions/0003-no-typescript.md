# ADR 0003: No TypeScript — plain JavaScript + JSX

Date: 2026-05-12
Status: Accepted

## Context

TypeScript is the default for most new JavaScript projects. We chose to stay on plain JavaScript + JSX for this codebase.

## Decision

The repo is pure JavaScript:
- `"type": "module"` in every `package.json`.
- `.js` for server code, `.jsx` for React components.
- No `tsconfig.json`, no `.d.ts` files, no `@types/*` runtime dependencies. (`@types/react` is present only as a devDep that some tooling expects; we don't write TypeScript against it.)
- Use **JSDoc** for type hints where they pay off — primarily on service methods and shared utilities.

## Consequences

**Good**
- Zero build step on the server (Node runs ESM directly with `"type": "module"`).
- Faster iteration — no `tsc --watch`, no type-only build failures.
- Lower barrier to contribution for a hobby/personal project.

**Bad**
- Refactoring is less safe. Renaming a field on a Mongoose schema doesn't surface call sites that still use the old name. Mitigation: keep schema enums in `server/src/config/constants.js` and import them — the linter catches typos in `enum` usage.
- API response shapes drift more easily between client and server. Mitigation: the standardized `{ success, message, data }` envelope keeps the top-level shape stable; deeper drift surfaces in tests.
- Editor autocomplete is weaker. Mitigation: JSDoc on service methods gives parameter types and return types where it matters most.

## Alternatives considered

- **Full TypeScript** — non-trivial migration cost, slows down day-to-day work for marginal benefit at current scale.
- **TypeScript-via-JSDoc with `checkJs: true`** — gives most of the safety without `.ts` files. Worth considering if/when refactoring becomes painful. Not adopted today because the JSDoc coverage is still spotty.

## Trigger to revisit

If the codebase grows past ~30 contributors or ~100k LOC, or if we add a public SDK that consumers depend on, reconsider TypeScript or at least `checkJs: true` with comprehensive JSDoc.

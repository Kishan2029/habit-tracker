---
description: Add a single endpoint to an existing resource — validator rule + service method + controller + route + Swagger + test.
---

Add a single endpoint to an existing resource. Follow the conventions in `server/CLAUDE.md`.

Arguments: **$ARGUMENTS**

Expected format: `<METHOD> <path> <description>` — e.g. `POST /habits/:id/duplicate "Duplicate a habit"`. If the arguments are missing or ambiguous, ask the user for the HTTP method, path, and one-line description before proceeding.

## Steps

1. **Identify the resource** from the path (e.g. `/habits/...` → `habits`). Locate:
   - `server/src/routes/<resource>Routes.js`
   - `server/src/controllers/<resource>Controller.js`
   - `server/src/services/<resource>Service.js`
   - `server/src/validators/<resource>Validators.js`

2. **Add a validator rule array** (only if the endpoint accepts a body or non-trivial params). Append to `<resource>Validators.js` as `export const <action>Rules = [...]`.

3. **Add a service method** to `<resource>Service.js`. Pure business logic. Throw `AppError` on failures. If this is a write that affects cached read paths, call `this._invalidateCache(userId)`.

4. **Add a controller** in `<resource>Controller.js`:
   ```js
   export const <action> = catchAsync(async (req, res) => {
     const data = await <resource>Service.<method>(...);
     sendSuccess(res, { ... }, '<message>', <statusCode if not 200>);
   });
   ```

5. **Wire the route** in `<resource>Routes.js`:
   - Insert in a logical position (the existing files group by HTTP verb / resource shape).
   - Chain: `<idParamRule if path has :id>, <bodyRules if any>, validate, <handler>`.
   - Add an `@swagger` JSDoc block immediately above. Match the format used elsewhere in the same file (path, tags, security, parameters, requestBody, responses).

6. **Add a test** in `server/src/__tests__/services/<resource>Service.test.js` and, if behavior is non-trivial, `controllers/<resource>Controller.test.js`. Cover happy path + at least one failure case. **Coverage thresholds are 100% on services + controllers — don't regress them.**

7. **Run** `cd server && npm test` and confirm green.

8. **Client side (only if asked)** — add a function to `client/src/api/<resource>Api.js` that wraps the new endpoint.

## Reporting

List every file touched, the new endpoint's signature, and the test results. Note any auth / authorization assumptions you made (e.g. "assumed user-scoped, no admin gate").

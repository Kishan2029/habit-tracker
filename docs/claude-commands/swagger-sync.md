---
description: Audit server routes for missing or stale @swagger JSDoc annotations.
---

Audit `server/src/routes/*.js` for missing or out-of-date `@swagger` JSDoc annotations.

## Steps

1. For every route file under `server/src/routes/` (excluding `index.js`):
   - List every endpoint registered (`router.get/post/put/patch/delete(...)`).
   - For each endpoint, check whether a `@swagger` JSDoc block exists in the lines immediately above.
   - If a block exists, sanity-check that:
     - The `path` matches the route.
     - The HTTP method matches.
     - Path/query/body params declared in the route or its validator rules are present in the swagger block.

2. Build a report grouped by file:

```
habitRoutes.js
  GET    /habits                  — ok
  PUT    /habits/reorder          — warn: swagger block exists but missing requestBody.items
  DELETE /habits/:id/freeze       — missing: no swagger annotation found
```

3. Don't fix anything automatically. Just report.

## Notes

- Swagger UI is the only API reference for this project — missing annotations mean the endpoint is invisible to anyone using `/api-docs`.
- The `index.js` `/health` endpoint has its own annotation; skip it.
- Pure middleware mounts (`router.use(authenticate)`) are not endpoints and should not be flagged.

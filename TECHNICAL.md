# Technical Documentation

The deep technical reference for this codebase has been split into focused files under `docs/`. Start here, then jump to whichever one matches what you're working on.

| Topic | File |
|-------|------|
| Request lifecycle, layered backend, frontend tree, services, jobs, deployment | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Mongoose schemas, fields, indexes, relationships | [`docs/DATA_MODELS.md`](./docs/DATA_MODELS.md) |
| Test setup, ESM mocking pattern, coverage thresholds | [`docs/TESTING.md`](./docs/TESTING.md) |
| Why we made specific structural choices | [`docs/decisions/`](./docs/decisions/) |
| Booby traps that have bitten us | [`GOTCHAS.md`](./GOTCHAS.md) |
| Product features and user-facing behavior | [`README.md`](./README.md) |
| Live API reference | `http://localhost:5000/api-docs` (Swagger UI, dev only) |
| Repo-wide Claude rules | [`CLAUDE.md`](./CLAUDE.md) |
| Frontend Claude rules | [`client/CLAUDE.md`](./client/CLAUDE.md) |
| Backend Claude rules | [`server/CLAUDE.md`](./server/CLAUDE.md) |

If you're new to the repo, read in this order: `README.md` → `docs/ARCHITECTURE.md` → `docs/DATA_MODELS.md` → `GOTCHAS.md`. Skim the ADRs in `docs/decisions/` before suggesting structural changes.

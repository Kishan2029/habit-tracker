# ADR 0005: Per-instance `node-cache` instead of Redis

Date: 2026-05-12
Status: Accepted

## Context

The server has read-heavy endpoints — most notably `GET /habits` — that are hit on every page load, often multiple times per minute per user. A small cache in front of Mongoose drops DB load and tail latency.

A shared cache layer like Redis is the textbook solution for multi-instance deployments. But this server currently runs as a single Vercel serverless function or a single process, and the operational cost of adding Redis (provisioning, env vars, failure mode handling, eviction tuning) is real.

## Decision

Use `node-cache` (in-memory, per-process) wrapped in `server/src/services/cacheService.js`. Provide `get`, `set`, `del`, `delByPrefix`. Default TTL 300s; per-call overrides (e.g. habit lists use 120s).

The wrapper maintains a prefix lookup so `delByPrefix('habits:userId123')` is O(1) — not a key-by-key scan. This makes invalidation cheap so services can be aggressive about it.

Every write that affects a cached read path calls a private `_invalidateCache(userId)` on the service. The pattern is documented in `server/CLAUDE.md`.

## Consequences

**Good**
- Zero external dependencies, zero env vars.
- Sub-millisecond reads on cache hits.
- Simple deployment (Vercel function, one server, no Redis).

**Bad**
- **Not shared across instances.** If we horizontally scale, each instance has its own cache and writes on one instance don't invalidate the others. A stale read window is the worst-case outcome — not a correctness bug for this app, but worth flagging.
- Lost on every process restart. Acceptable since the cache is a performance optimization, not a source of truth.
- Memory bound to the process — if we cached aggressively across all users, we'd hit limits. Current usage is conservative (120s TTL on habit lists, small per-user keyspace).

## Alternatives considered

- **Redis** — correct for multi-instance, but adds an external dependency, env vars (`REDIS_URL`), connection management, and a new failure mode. Not justified at single-instance scale.
- **No cache** — measurably slower under load. Habit lists are queried on every page navigation.
- **Mongoose query plan caching only** — helps but doesn't address the application-level latency or the redundant query work.

## Trigger to revisit

If we scale to multiple server instances **or** the cache memory footprint becomes meaningful (more than a few MB sustained), migrate to Redis. The `cacheService` wrapper is the only place that needs to change — call sites stay identical.

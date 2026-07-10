# Data Model & Persistence

## The schema (all of it)

Three tables — [schema.ts](../../../packages/db/src/schema.ts):

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id` uuid PK, `email` unique, `password_hash`, `tz`, `display_name` | [L14-L22](../../../packages/db/src/schema.ts#L14-L22); `tz` is IANA string — streak rollover depends on it |
| `refresh_tokens` | `id`, `user_id` FK cascade, `token_hash` unique, `expires_at` | [L25-L33](../../../packages/db/src/schema.ts#L25-L33); rows deleted on rotation |
| `progress_events` | **PK (`user_id`,`id`)**, `type`, `payload` jsonb, `occurred_at` bigint, `synced_at` | [L41-L59](../../../packages/db/src/schema.ts#L41-L59); index on (`user_id`,`occurred_at`) |

What's deliberately *absent* (vs. the original spec) and why — the repo's biggest data-modeling decision:

1. **No content tables.** Courses/lessons live in immutable bundle files served from disk ([routes/content.ts#L5-L10](../../../apps/api/src/routes/content.ts#L5-L10)). The DB holds only what's per-user and mutable. Fewer sync problems, no seed pipeline. Cost: no server-side queries over content (e.g., "hardest exercise" analytics) without loading JSON.
2. **No derived-state tables** (`user_state`, xp totals). Progress is recomputed from events per request ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)). **Consistency** consequence: derived values can never be stale or drift from the log — a whole bug class (cache invalidation on your own DB) removed. Cost: O(events per user) reads; needs a snapshot/cache table someday. Know the migration path: add a `user_state` cache keyed by last-event-id, rebuildable — *because events are append-only, the cache is always safely rebuildable.* That sentence is interview gold.

## Event-sourced-lite, precisely

This is *not* full event sourcing (no versioned aggregates, no projections infra). It keeps the useful 20%: append-only facts + deterministic fold. The append-only property is enforced by API shape (no update/delete endpoints exist) rather than DB permissions — worth naming as a trust assumption.

**Idempotency key:** the client-generated event UUID, made unique per user by the composite PK ([schema.ts#L57](../../../packages/db/src/schema.ts#L57)). Why composite instead of global-unique `id`? A malicious client replaying *another user's* event IDs could otherwise cause silent drops for that victim. Small design detail, real security reasoning — say it in interviews.

**Why `occurred_at` is a bigint (epoch ms) not timestamptz:** it mirrors the client's `Date.now()` exactly; timezone math happens in one place (the reducer, via the user's IANA `tz`), not in SQL. One clock representation end-to-end.

## Transactions and consistency expectations

- `/sync`'s multi-row insert is a single statement → atomic per batch ([sync.ts#L47-L60](../../../apps/api/src/routes/sync.ts#L47-L60)). No explicit `db.transaction` anywhere in the API — verified by `rg "transaction" apps/api` (no hits). Acceptable because every write path is single-statement; the moment refresh rotation (delete + insert, [routes/auth.ts#L54-L58](../../../apps/api/src/routes/auth.ts#L54-L58)) or multi-step writes appear, that assumption should be revisited. It's fail-closed today (crash = user re-logs-in).
- Client↔server consistency is **eventual**: local outbox now, server later; convergence is guaranteed by idempotent replay + order-independent reduction (tested: [events.test.ts#L23-L29](../../../packages/core/src/events.test.ts#L23-L29)).

## How to change the schema safely here

1. Write the change in [schema.ts](../../../packages/db/src/schema.ts); `pnpm --filter @aral/db generate` → review generated SQL in `migrations/`; `pnpm db:migrate` locally; commit both.
2. **Expand → migrate → contract** for anything non-additive: add nullable column, backfill, ship code reading both, then tighten. Never rename in place — old API processes may run during deploy.
3. Event payload changes are harsher than column changes: old events are *immutable data* — the reducer must handle every historical shape forever (or you write a one-time payload migration). Adding an optional field is safe; renaming `xp` is not. Grep the reducer before touching any event field.
4. Rollback story: migrations here have no down-scripts (drizzle default). Rollback = new forward migration. Fine for append-only; say so explicitly in an interview rather than pretending down-migrations exist.

## Drill

Design (on paper) the migration to add "daily XP goal" per user: column vs settings jsonb vs new event type? Constraint: offline mobile must respect the goal. Work through where each option's logic would live and what syncs. Strong answer notices a *setting* is state (LWW via `PATCH /me`, [me.ts#L19-L27](../../../apps/api/src/routes/me.ts#L19-L27)) while *goal progress* is already derivable from `lesson_completed` events — so: column + derived, no new event.

Interview angle: "SQL vs NoSQL?" is usually a trap; the real question is "what did you store and why." This schema — relational core + jsonb payloads where shape varies — is the pragmatic hybrid worth describing. → [API & data Q-cards](../08-interview-prep/03-api-and-data-modeling-questions.md)

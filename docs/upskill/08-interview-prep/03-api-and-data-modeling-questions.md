# API & Data Modeling Cards

12 cards anchored to the actual API and schema.

## Q1: Design an endpoint for clients that sync after being offline.
Round: API. Repo anchor: the whole of [sync.ts](../../../apps/api/src/routes/sync.ts) — batch, idempotent, derived response.
Junior: POST per action.
Mid: batch endpoint; client-generated ids; server dedupe; return authoritative state so the client reconciles in one round trip.
Senior: ordering independence requirement on the server's fold; clamping untrusted timestamps ([L56-L57](../../../apps/api/src/routes/sync.ts#L56-L57)); batch-size caps and what happens above them.

## Q2: Where does validation live in your API and why zod specifically there?
Round: API. Repo anchor: [sync.ts#L8-L33](../../../apps/api/src/routes/sync.ts#L8-L33), [auth routes#L7-L12](../../../apps/api/src/routes/auth.ts#L7-L12).
Mid: parse-don't-validate at the edge; typed data flows inward; bounds (xp≤100, ≤500 events) not just types.
Senior: schema/type duplication risk in this repo and single-source fix ([type contracts](../../02-stack-and-language-mastery/03-type-system-and-contracts.md)); validation as *the* trust boundary because TS erases.

## Q3: How do you prevent users reading each other's data?
Round: API/security. Repo anchor: `userId` from token only ([sync.ts#L52](../../../apps/api/src/routes/sync.ts#L52), [me.ts#L9-L26](../../../apps/api/src/routes/me.ts#L9-L26)).
Junior: "check permissions."
Mid: structural scoping — no endpoint accepts foreign resource ids; IDOR impossible by shape.
Senior: when that stops scaling (sharing, admin, teams) → explicit authz layer; and the *query-level* discipline (every WHERE carries the tenant) as the transferable rule.

## Q4: Access token vs refresh token — design the lifecycle.
Round: API/auth. Repo anchor: [auth.ts#L13-L33](../../../apps/api/src/auth.ts#L13-L33); rotation [routes/auth.ts#L45-L58](../../../apps/api/src/routes/auth.ts#L45-L58).
Mid: 15m JWT stateless; 30d refresh random+hashed+single-use; rotation narrows stolen-token windows.
Senior: reuse-detection gap (family revocation, [trace 3](../../04-code-reading-gym/02-trace-tables.md)); storage tradeoff (localStorage XSS vs cookie CSRF); revocation limits of stateless access tokens.

## Q5: Why store events instead of current state? Argue both sides.
Round: data modeling. Repo anchor: [progress_events](../../../packages/db/src/schema.ts#L41-L59) vs the absent `user_state` table.
Junior: "audit log."
Mid: events make sync idempotent and state rebuildable; no cache-drift class; the cost — O(history) reads and eternal schema compatibility.
Senior: the hybrid endgame (snapshot keyed by last event id); when plain CRUD wins (single writer, no offline); "we removed a bug class and accepted a scaling debt, with a written trigger."

## Q6: Model the schema for this app — defend every table you *didn't* create.
Round: data modeling. Repo anchor: 3 tables ([schema.ts](../../../packages/db/src/schema.ts)); content deliberately fileborne ([data model doc](../../03-architecture-and-patterns/02-data-model-and-persistence.md)).
Mid: users/tokens/events; content immutable files; derived state computed.
Senior: jsonb payload column tradeoff (schema-light, index-light — the (user_id, occurred_at) index covers the only query, [L58](../../../packages/db/src/schema.ts#L58)); when content moves into tables (querying/analytics needs).

## Q7: How do you change a schema safely with zero downtime?
Round: data. Repo anchor: drizzle migrations dir ([packages/db/migrations](../../../packages/db/migrations)); forward-only stance.
Mid: expand → migrate → contract; additive first; old code must run against new schema during deploys.
Senior: this repo's harder version — *event payloads* are schema too, and old mobile writers exist; rollback = roll-forward; migration review as PR artifact.

## Q8: Pagination — none of your endpoints paginate. Defend or fix.
Round: API. Repo anchor: [progress.ts#L7-L11](../../../apps/api/src/progress.ts#L7-L11) unbounded select; [sync.ts#L33](../../../apps/api/src/routes/sync.ts#L33) caps writes at 500.
Mid: reads need full history for the fold (defensible); writes are capped; list-shaped *user-facing* endpoints (none yet) would need cursor pagination.
Senior: cursor-vs-offset reasoning ready for the leaderboard follow-up; the snapshot table as the thing that makes bounded reads possible later.

## Q9: What's your API's error contract?
Round: API. Repo anchor: `{ error: string }` + status, e.g. [sync.ts#L44](../../../apps/api/src/routes/sync.ts#L44), uniform 401s ([auth.ts#L40-L48](../../../apps/api/src/auth.ts#L40-L48)).
Mid: consistent shape, correct status codes, no internals leaked; client maps 401 → refresh ([progress.tsx#L97-L106](../../../apps/web/src/lib/progress.tsx#L97-L106)).
Senior: error taxonomy as contract (which 4xx are retryable?); the batch-rejection semantics gap ([ticket 7](../../06-contribution-practice/01-good-first-tickets.md)) as an example of underspecified errors biting.

## Q10: Add caching to this API — where and where not?
Round: API/perf. Repo anchor: immutable bundle headers ([content.ts#L26-L27](../../../apps/api/src/routes/content.ts#L26-L27)); no caching on `/me` (and [review kata 3](../../04-code-reading-gym/04-review-katas.md) on why not yet).
Mid: cache immutable artifacts forever at the HTTP layer; don't cache per-user derived state without an invalidation story.
Senior: cache keyed by last-event-id = provably fresh; TTL caches on top of an event log throw away its best property.

## Q11: How would you rate-limit this API?
Round: API/security. Repo anchor: gap at [app.ts#L16-L28](../../../apps/api/src/app.ts#L16-L28); [ticket 9](../../06-contribution-practice/01-good-first-tickets.md).
Mid: per-IP on auth trio first (brute force); 429 + Retry-After; sync gets generous per-user limits.
Senior: keying (IP vs user vs both), distributed counting (single node now — say so), and *not* limiting what doesn't need it.

## Q12: Multi-tenancy — this app is single-user-scoped. What changes for orgs/classrooms?
Round: data modeling. Repo anchor: everything keyed by `user_id` alone ([schema.ts](../../../packages/db/src/schema.ts)).
Mid: add tenant id to every table + every query + every index prefix; membership/roles table; authz middleware replaces structural scoping.
Senior: tenant isolation levels (shared schema w/ tenant column vs schema-per-tenant vs DB-per-tenant) with cost/blast-radius tradeoffs; cross-tenant leak tests as first-class CI ([writing-tests-here recipe 6](../../05-quality-engineering/02-writing-tests-here.md) generalized).

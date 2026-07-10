# Architecture Critique

An honest review, written the way you'd deliver it after three months owning this codebase. Doubles as system-design interview prep — cross-linked from [08/04](../08-interview-prep/04-system-design-from-this-repo.md).

## Strongest design choices (defend these in interviews)

1. **Event log as the progress substrate.** One decision bought: guest mode, offline play, multi-device merge, idempotent sync, audit trail, and rebuildable derived state. Evidence of payoff: the server's `/me` is 8 lines ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)) because it reuses the client's reducer.
2. **Pure, dependency-free core** with `now` injected — 27 fast tests, no mocks ([packages/core](../../../packages/core/src)).
3. **Single write path** for progress (`/sync` only) — one endpoint to secure and reason about (API-01 held; verified: no other progress mutations exist in [apps/api/src/routes](../../../apps/api/src/routes)).
4. **Content as compiled immutable artifacts** — human-editable source, machine-checked output, cache-forever delivery ([compile.ts](../../../packages/content/src/compile.ts), [content routes headers](../../../apps/api/src/routes/content.ts#L26-L27)).
5. **Right-sized security touches for the stage:** hashed refresh tokens, rotation, argon2, boot-fail on default secret in prod ([env.ts#L18-L20](../../../apps/api/src/env.ts#L18-L20)) — someone thought about failure, not just features.

## Risks and tradeoffs (confirmed vs hypothesis)

| # | Issue | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Zero automated tests outside core (API, web, mobile untested) | **Confirmed** | only `packages/core/src/*.test.ts` exist |
| 2 | Gamification values are client-asserted (xp per event ≤100 but unverified against lesson) | **Confirmed** | [sync.ts#L14](../../../apps/api/src/routes/sync.ts#L14) |
| 3 | Backdated `occurredAt` accepted (only future is clamped) → streak forgery | **Confirmed** | [sync.ts#L56-L57](../../../apps/api/src/routes/sync.ts#L56-L57) |
| 4 | Tokens in localStorage (web) — XSS-readable | Confirmed by design | [progress.tsx#L21](../../../apps/web/src/lib/progress.tsx#L21) |
| 5 | No rate limiting anywhere | **Confirmed** | no limiter registered in [app.ts](../../../apps/api/src/app.ts#L16-L28) |
| 6 | Duplicated store policy web/mobile will drift | Hypothesis (structural) | parallel files compared in [boundaries](01-boundaries-and-layers.md) |
| 7 | Event zod schema duplicated from core types | Confirmed | [sync.ts#L8-L32](../../../apps/api/src/routes/sync.ts#L8-L32) |
| 8 | Per-request full-history reduce | Confirmed, currently cheap | [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) |
| 9 | Unchunked client push vs 500-event server cap | Hypothesis — needs a long-offline test | [sync.ts#L33](../../../apps/api/src/routes/sync.ts#L33) vs [mobile progress.tsx#L62-L66](../../../apps/mobile/src/lib/progress.tsx#L62-L66) |
| 10 | Register race returns 500 not 409 under concurrent duplicate emails | Hypothesis (code-read) | [routes/auth.ts#L20-L23](../../../apps/api/src/routes/auth.ts#L20-L23) |

## Prioritized improvements — "owning it for 3 months"

Each with migration path + test strategy, because recommendations without those are opinions.

1. **API integration test suite** (week 1). Highest leverage: every other change becomes safe. Path: vitest + `buildApp()` against a dockerized or embedded Postgres (Testcontainers-style, or a transaction-rollback harness); golden tests for register/login/refresh/sync-idempotency (`accepted` counts, replay invariance). No product code changes required — `buildApp({databaseUrl})` already injects ([app.ts#L16-L19](../../../apps/api/src/app.ts#L16-L19)). That injectability was luck-or-foresight; use it.
2. **Single-source event schemas** (week 1–2). Move zod schemas into `packages/core`, `z.infer` the types, API imports the schemas. Migration: additive, zero behavior change; tests: typecheck + existing manual smoke → then covered by (1).
3. **Server-side XP derivation** (week 2–3, before any social feature). `/sync` looks up `lessonId` in the bundle (API already has it on disk), computes xp server-side, ignores client value (keep field for compat, log divergence first — *measure before enforcing*). Test: sync a forged 100xp event, expect derived value.
4. **Sync status surfacing + backoff** (week 3). Expose outbox length + last-sync time in `/me`-adjacent UI; add exponential backoff with jitter. Test: reducer-level unit tests + a fake-timer store test.
5. **Snapshot table when p95 `/me` > ~50ms** (someday). `user_state(user_id, last_event_id, progress jsonb)`; rebuild on mismatch. Deliberately last: it re-introduces cache-drift risk, which the current design elegantly lacks. Migration: additive table, dual-read with comparison logging first.

Not recommended despite temptation: rewriting clients' stores into one shared abstraction *before* tests exist (change risk exceeds drift risk today), and switching to httpOnly cookies *while* the only client is same-team (do it when third-party embedding or real traffic appears).

## Drill

Pick improvement #3 and write its one-page design note: goal, non-goals, invariant ("displayed XP must equal server-derived XP after sync"), rollout (log-only → enforce), rollback (flag), test list. 30 minutes, timed.

Self-grade — Strong: your note includes the offline wrinkle (client must predict xp locally → shared function in core keeps prediction and enforcement identical — the repo's own philosophy, applied).

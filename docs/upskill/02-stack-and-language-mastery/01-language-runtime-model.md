# Language & Runtime Model

## The event loop, in one paragraph you can say aloud

JavaScript runs one call stack. I/O (fetch, DB queries, timers) is delegated to the host; completions come back as **macrotasks** (timers, I/O callbacks) or **microtasks** (promise reactions). After every macrotask, the *entire* microtask queue drains before rendering or the next macrotask. `await` is sugar: everything after it is a microtask continuation. Blocking the stack blocks everything — timers late, UI frozen, server unresponsive.

### Where this repo leans on it

- **Debounced background sync** ([web progress.tsx#L137-L141](../../../apps/web/src/lib/progress.tsx#L137-L141)): a `setTimeout` (macrotask) scheduled by an effect, canceled on re-run. Predict: user completes 3 exercises in 1 second — how many `/sync` calls? (One: each new outbox state re-runs the effect, clearing the previous timer.)
- **Fire-and-forget with `void`** ([mobile progress.tsx#L108](../../../apps/mobile/src/lib/progress.tsx#L108) `void syncNow()`): deliberately unawaited promise. The `.catch(() => {})` inside `syncNow` ([L84-L87](../../../apps/mobile/src/lib/progress.tsx#L84-L87)) is what stops unhandled-rejection crashes. Transferable rule: every floating promise needs an owner for its failure.
- **Serial awaits that could be parallel**: [storage.ts#L61-L65](../../../apps/mobile/src/lib/storage.ts#L61-L65) deletes outbox rows one-by-one in a loop — fine inside a synchronous SQLite transaction, but the same shape with `await` per network call would be an N-round-trip bug. Contrast with `Promise.all` batching. Know when serial is *required* (ordering, transactions) vs habit.

### Failure modes to name in interviews

1. Unhandled rejection from a floating promise (process crash in Node ≥15).
2. Await-in-loop latency (serial when parallel was safe).
3. Zombie timers after unmount — why the cleanup function at [progress.tsx#L140](../../../apps/web/src/lib/progress.tsx#L140) exists.
4. Blocking the loop with sync CPU work (argon2 here is native + async — [auth.ts#L9-L11](../../../apps/api/src/auth.ts#L9-L11); hashing synchronously would stall every request).

## Node vs browser vs Hermes in this repo

| Concern | api (Node) | web (browser) | mobile (Hermes) |
| --- | --- | --- | --- |
| Storage | Postgres | localStorage | SQLite (sync driver) |
| Crypto | `node:crypto` ([auth.ts#L22-L27](../../../apps/api/src/auth.ts#L22-L27)) | `crypto.randomUUID` w/ fallback ([progress.tsx#L155-L160](../../../apps/web/src/lib/progress.tsx#L155-L160)) | same fallback pattern ([mobile progress.tsx#L146-L153](../../../apps/mobile/src/lib/progress.tsx)) |
| Time/tz | server must NOT trust its own tz for streaks | `Intl` for tz ([streak.ts#L14-L21](../../../packages/core/src/streak.ts#L14-L21)) | same — `Intl` availability on Hermes is why the try/catch exists ([mobile progress.tsx#L22-L28](../../../apps/mobile/src/lib/progress.tsx#L22-L28)) |

`packages/core` works on all three because it touches none of the host APIs — the **isomorphic core** discipline. The reducer takes `now: number` as a parameter ([events.ts#L49-L54](../../../packages/core/src/events.ts#L49-L54)) instead of calling `Date.now()`: that's not style, it's what makes time-dependent logic testable ([events.test.ts#L41-L47](../../../packages/core/src/events.test.ts#L41-L47) tests "future" clocks deterministically).

## Drills

1. **Predict-then-run:** in [web progress.tsx#L88-L112](../../../apps/web/src/lib/progress.tsx#L88-L112), a 401 triggers `api.refresh` then a retry. If the refresh *also* 401s, what does the user experience? Trace it. (The throw propagates to `syncNow`'s `.catch(() => {})` — outbox silently retained; user sees nothing. Decide: bug or feature? Defend both.)
2. **Rewrite kata:** take `outboxClear` ([storage.ts#L61-L66](../../../apps/mobile/src/lib/storage.ts#L61-L66)) and write the single-statement SQL alternative (`DELETE ... WHERE id IN (...)`). What changes about failure atomicity? (Nothing — it's already in a transaction; but statement count drops from N to 1.)
3. **Say it aloud:** explain why hearts need no `setInterval` anywhere except a 30-second *display* tick. 60 seconds max.

Self-grade — Basic: correct predictions. Solid: correct + named the queue (micro vs macro) involved. Strong: you connected each to a production failure you can describe.

## Interview angle

- "Explain the event loop" → answer with the debounce + floating-promise examples above, not the textbook diagram. → [Q-cards: JS deep-dive](../08-interview-prep/01-js-ts-node-deep-dive.md)
- "Difference between `Promise.all` and sequential await?" → outbox flush example.
- "How do you handle time in tests?" → `now` as a parameter; point at `reduceEvents`.
- "What's different about Node vs browser?" → the three-column table above, from one repo.

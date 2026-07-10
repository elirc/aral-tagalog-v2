# JS/TS/Node Deep-Dive Cards

14 cards. Protocol: answer aloud in 90 seconds, then compare.

## Q1: Walk me through what the event loop does when a request hits your server.
Round: JS deep-dive. Testing: real model vs memorized diagram.
Repo anchor: [sync.ts#L41-L66](../../../apps/api/src/routes/sync.ts#L41-L66) — an async handler with awaited DB calls.
Junior: "Node is single-threaded with callbacks."
Mid adds: handler runs on the stack until the first `await` (the insert); Node services other requests while Postgres works; continuation resumes as a microtask. Concurrency without threads — and why one CPU-heavy handler starves everyone.
Senior includes: where that model breaks — CPU-bound crypto (argon2 here is native+async precisely for that, [auth.ts#L9-L11](../../../apps/api/src/auth.ts#L9-L11)); microtask starvation; when you'd reach for worker threads.
Follow-ups: "What's the difference between `setTimeout(fn,0)` and `queueMicrotask(fn)`?"
Drill: trace one `/sync` request naming each suspension point.

## Q2: `unknown` vs `any` — when have you actually used each?
Round: TS. Testing: whether strictness is practiced or preached.
Repo anchor: zod `safeParse(req.body)` treats bodies as untyped input ([sync.ts#L42](../../../apps/api/src/routes/sync.ts#L42)); the deliberate double-cast at [web content.ts#L9](../../../apps/web/src/lib/content.ts#L9).
Junior: "`any` disables checking, `unknown` is safer."
Mid adds: `unknown` forces narrowing before use — the correct type for every wire/storage input; shows the zod-at-boundary pattern.
Senior includes: the honest exception — a build-time-validated artifact cast once with a comment (content.ts) — and why a *localized, justified* cast beats `any` contagion.
Follow-ups: "How do you keep casts from spreading?" (one cast at the boundary, typed from there).

## Q3: What do discriminated unions give you over class hierarchies?
Round: TS. Repo anchor: [types.ts#L108-L114](../../../packages/core/src/types.ts#L108-L114), consumed exhaustively in [grading.ts#L35-L61](../../../packages/core/src/grading.ts#L35-L61).
Junior: "You switch on a type field."
Mid adds: exhaustiveness — adding an `Exercise` variant makes every unhandled switch a compile error; and unions serialize (JSON) where classes don't.
Senior includes: when classes win (behavior-heavy, no serialization) and the runtime mirror problem — unions erase, so the wire needs zod's `discriminatedUnion` ([sync.ts#L8](../../../apps/api/src/routes/sync.ts#L8)).
Drill: whiteboard the union for a payment-webhook payload.

## Q4: How do you make time-dependent logic testable?
Round: JS/testing. Repo anchor: [reduceEvents(events, tz, now)](../../../packages/core/src/events.ts#L49-L55); tests pin `now` ([events.test.ts#L5-L6](../../../packages/core/src/events.test.ts#L5-L6)).
Junior: "Mock Date.now with jest."
Mid adds: better — inject the clock as a parameter; no mocking framework, deterministic, works in any runner.
Senior includes: the boundary version (clock as dependency at the edges, pure functions inside) and where fake timers are still right (debounce tests).

## Q5: Explain closures with a bug you've seen.
Round: JS. Repo anchor: the effect + `useCallback` dependency chain in [progress.tsx#L108-L141](../../../apps/web/src/lib/progress.tsx#L108-L141).
Junior: defines closures.
Mid adds: stale-closure bug shape — an effect capturing an old `outbox`; why the dependency array *is* closure management.
Senior includes: the ref escape hatch (`completionSent`, [LessonPlayer.tsx#L39](../../../apps/web/src/components/LessonPlayer.tsx#L39)) for values that must persist without re-rendering — and its cost (invisible to React's model).

## Q6: How does error handling differ between user-initiated and background async work?
Round: JS. Repo anchor: AuthForm surfaces errors ([AuthForm.tsx#L28-L33](../../../apps/web/src/components/AuthForm.tsx#L28-L33)); syncNow swallows ([progress.tsx#L112-L115](../../../apps/web/src/lib/progress.tsx#L112-L115)).
Junior: "try/catch everywhere."
Mid adds: the policy split — user actions must resolve to visible outcomes; background work may swallow *if* there's a retry story and the data survives (outbox retained).
Senior includes: swallowing without a counter is an observability hole (this repo's, named); unhandled rejections crash Node — every floating promise needs an owner.

## Q7: What's an idempotent operation and why do you care?
Round: JS/systems. Repo anchor: [sync.ts#L60](../../../apps/api/src/routes/sync.ts#L60) + composite PK ([schema.ts#L57](../../../packages/db/src/schema.ts#L57)).
Junior: "Same call twice = same result."
Mid adds: retries make at-least-once delivery the norm; client-generated UUID + conflict-ignore = safe replays; the curl-twice demo.
Senior includes: idempotency *scope* (per-user keys to prevent cross-user denial) and the difference between idempotent-by-storage vs idempotent-by-check (TOCTOU).

## Q8: Node module systems — what bites people in a monorepo?
Round: Node. Repo anchor: raw-TS workspace exports ([core package.json#L6](../../../packages/core/package.json#L6)) + `transpilePackages` ([next.config.mjs](../../../apps/web/next.config.mjs)).
Junior: "ESM vs CJS syntax."
Mid adds: packages that ship TS/ESM need consumer-side handling; the "Unexpected token 'export'" failure and where it comes from.
Senior includes: dual-package hazards, and the types-duplication war story ([tooling incident #1](../../02-stack-and-language-mastery/04-tooling-and-build-system.md)).

## Q9: How would you hash passwords, and why not SHA-256?
Round: Node/security. Repo anchor: [auth.ts#L9-L11](../../../apps/api/src/auth.ts#L9-L11) (argon2); contrast: sha256 *is* used for refresh tokens ([L27](../../../apps/api/src/auth.ts#L27)) — do you know why that's OK?
Junior: "bcrypt/argon2 are slow on purpose."
Mid adds: memory-hard KDFs resist GPU cracking of low-entropy inputs (passwords); tokens are high-entropy random — fast hash suffices there. That distinction is the whole card.
Senior includes: parameter tuning vs login latency budget, and rotation strategy when params change (rehash-on-login).

## Q10: Promise.all vs allSettled vs sequential — give a real decision.
Round: JS. Repo anchor: serial audio prefetch ([mobile audio.ts#L34-L47](../../../apps/mobile/src/lib/audio.ts#L34-L47)).
Junior: describes each.
Mid adds: the prefetch chose serial deliberately (radio/battery, self-throttling); `all` fails fast (wrong here), `allSettled` + concurrency limit is the upgrade.
Senior includes: backpressure vocabulary; unbounded `Promise.all` over user-sized lists as a production incident pattern.

## Q11: What does `structuredClone`/spread vs mutation have to do with your state bugs?
Round: JS. Repo anchor: immutable session transitions ([session.ts#L45-L84](../../../packages/core/src/session.ts#L45-L84) always returns new objects).
Junior: "Spread copies."
Mid adds: shallow-vs-deep; why React state demands new identities; how the engine's immutability lets the player hold "current" and "next" state simultaneously ([LessonPlayer.tsx#L100-L119](../../../apps/web/src/components/LessonPlayer.tsx#L100-L119)).
Senior includes: immutability as an API contract (callers can cache safely), and its cost at scale (GC pressure — usually irrelevant, measure).

## Q12: How do you version data that lives on devices you don't control?
Round: JS/systems. Repo anchor: events persisted in localStorage/SQLite forever ([fake-code contrast #9](../04-code-reading-gym/03-fake-code-contrasts.md)); bundle versioning ([mobile content.ts#L21-L33](../../../apps/mobile/src/lib/content.ts#L21-L33)).
Junior: rarely has an answer — this card is a differentiator.
Mid adds: additive-only changes; readers tolerate missing fields; version numbers on artifacts.
Senior includes: old *writers* exist too (mobile binaries) — the server must accept old shapes indefinitely; expand-migrate-contract.

## Q13: `JSON.parse` failed in production — walk me through your defense layers.
Round: Node. Repo anchor: [web load()](../../../apps/web/src/lib/progress.tsx#L23-L31) catches; [mobile outboxAll](../../../apps/mobile/src/lib/storage.ts#L55-L59) doesn't — a real asymmetry you found.
Junior: "wrap in try/catch."
Mid adds: catch is layer 1; shape validation is layer 2 (missing here — [ticket 5](../06-contribution-practice/01-good-first-tickets.md)); quarantine-don't-crash for persistent queues.
Senior includes: poison-message policy as a *system* concern (same logic as [sync batch rejection](../../05-quality-engineering/03-systematic-debugging.md), scenario 2).

## Q14: What actually happens when two async functions "run at the same time" in Node?
Round: JS. Testing: interleaving model.
Repo anchor: two concurrent registers hitting the check-then-insert race ([routes/auth.ts#L20-L31](../../../apps/api/src/routes/auth.ts#L20-L31)).
Junior: "They run in parallel."
Mid adds: they *interleave at await points* on one thread; both can pass the duplicate check before either inserts — single-threaded ≠ race-free.
Senior includes: the fix hierarchy — DB constraint (serialization point) > app-level locks; and where true parallelism exists (libuv pool, native addons like argon2).
Practice drill: whiteboard the interleaving timeline for the register race, then say the fix in one sentence.

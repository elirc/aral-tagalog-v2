# Senior Build Projects

Six projects, 2 days–4 weeks. Each needs a written design *before* code and honest rollout/rollback. These are things a maintainer might actually accept.

---

## P1: Progress snapshot/cache layer (2–4 days)
Problem: per-request full-history reduce ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)) is the known scaling debt.
Product value: keeps `/me` and `/sync` fast as users age.
Architecture decisions: snapshot table `user_state(user_id, last_event_key, progress jsonb)` where `last_event_key = (occurredAt, id)` of the last folded event; on read, fold only newer events on top (the [baseline-overlay pattern](../03-architecture-and-patterns/05-pattern-catalog.md) — the codebase already proved it client-side, reuse `reduceEvents(events, tz, now, initial)`).
Migration plan: additive table; shadow mode first (compute both, log divergence), then serve from snapshot.
Test plan: property test — snapshot+delta ≡ full fold for random event sets; divergence alarm in shadow mode.
Security: none new. Performance: measure before/after with the [benchmark drill](../05-quality-engineering/04-performance-thinking.md).
Rollout/rollback: env flag; rollback = read path reverts to full fold (snapshot table is disposable — say that sentence in the design doc; disposability is the design).
Open questions: invalidate on tz change (PATCH /me) — recompute or version the snapshot by tz?
Stretch: nightly job verifying snapshots against full folds for a sample.
Interview story potential: "added a cache that is provably rebuildable — cache invalidation made boring."

## P2: Shared client sync engine (1–2 weeks)
Problem: web and mobile duplicate outbox/baseline/refresh policy ([boundaries leak #1](../03-architecture-and-patterns/01-boundaries-and-layers.md)).
Design: `packages/core/sync.ts` — `createSyncEngine({ storage: OutboxStorage, transport: SyncTransport, clock })`; platforms supply adapters (localStorage / SQLite; fetch impls). Pure-testable with fake adapters — finally making the store logic unit-testable (see [recipe 8](../05-quality-engineering/02-writing-tests-here.md)).
Architecture decisions: interface design is the deliverable — storage contract must be async (SQLite) even though web's is sync; error taxonomy (auth vs network vs poison).
Migration: web first (simpler), mobile second, delete duplicates last; behavior-lock with M1-style tests *before* moving anything.
Rollout/rollback: per-platform swap, revertible commits.
Open questions: does the engine own retries/backoff or leave triggers platform-specific? (Recommend: engine owns policy, platforms own triggers.)
Interview story: "extracted a cross-platform engine; designed the adapter seam."

## P3: End-to-end test rig — web lesson play (1 week)
Problem: zero E2E coverage; the core loop could break unnoticed.
Design: Playwright; docker Postgres + API + `next dev` orchestrated via a compose profile; 4 journeys only (guest lesson complete, wrong-answers-to-zero-hearts, register-and-adopt, practice refill). Data setup via the API (register fresh user per test), not DB fixtures — tests exercise real contracts.
Test plan meta: flake budget — retry once, quarantine list, <5min total.
Rollout: CI job behind a label first (e2e on demand), then required.
Open questions: mock audio 404s or accept them silently (they're silent by design — assert *no console errors* instead).
Interview story: "stood up pragmatic E2E: four journeys, five minutes, zero flake tolerance."

## P4: Multi-course support — es→tl (2–3 weeks)
Problem: schema says multi-course (CNT-01, [`Course keyed by (base,target)`](../../../packages/core/src/types.ts#L8-L20)); every client hardcodes `en-tl` ([web content.ts#L2-L9](../../../apps/web/src/lib/content.ts#L2-L9), [manifest route](../../../apps/api/src/routes/content.ts#L12-L17), [mobile content.ts](../../../apps/mobile/src/lib/content.ts)).
Product value: the spec's stated extension path — proves the abstraction before a real second course exists.
Architecture decisions: course selection state (user setting? URL?); progress events need a course dimension? (No — lesson ids are globally unique per bundle… *are they*? [compiler duplicate check](../../../packages/content/src/compile.ts#L158-L164) is per-bundle only. Found it: cross-course id collision is unguarded. Your design must fix id namespacing, e.g. `en-tl/greetings-1`, with a back-compat mapping for existing events.)
Migration plan: the event back-compat mapping is the hard part — write it first.
Rollout: second course behind a flag; en-tl untouched paths proven by tests.
Interview story: "turned a designed-for extension point into a real one, and found the id-namespace landmine the design missed."

## P5: Real-time-ish multi-device presence of progress (1–2 weeks)
Problem: device B learns about device A's progress only on next sync trigger.
Design exercise (the value is the *analysis*): options — polling `/me` on focus (trivial, good enough?), SSE stream of new events, WebSocket. Recommend: focus-triggered sync (already exists on mobile via AppState — [progress.tsx#L112-L117](../../../apps/mobile/src/lib/progress.tsx#L112-L117); add web visibilitychange parity), and *stop there* with a written argument. Building less after analyzing more is the senior move; the doc is the deliverable, plus the small web parity PR.
Interview story: "argued three transport options down to a 20-line fix."

## P6: Audio pipeline completion (1–2 weeks, product-heavy)
Problem: 83/83 audio refs unrecorded; players silently degrade.
Design: run [generate-audio.mjs](../../../packages/content/scripts/generate-audio.mjs) with a Piper voice; check artifacts into the bundle; add compiler *error* (not warning) for missing audio above a threshold %; document recording workflow for human replacement (AUD-01 beats AUD-02 — recorded clips win by file precedence, [script logic](../../../packages/content/scripts/generate-audio.mjs)).
Rollout: bundle v2; mobile hot-swap path finally exercised for real ([mobile content.ts#L21-L33](../../../apps/mobile/src/lib/content.ts#L21-L33)) — write the verification checklist for that first real content update.
Open questions: TTS Tagalog quality bar — define "good enough" with a native speaker.
Interview story: "shipped the first real content-update through a versioned-bundle pipeline, end to end."

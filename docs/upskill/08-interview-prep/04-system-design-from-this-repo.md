# System Design From This Repo

The whiteboard exercise: **"Design a Duolingo-style language-learning app: lessons, XP, streaks, lives, offline mobile."** You've studied a real implementation — this walkthrough shows what to say at each step, what this repo chose (with anchors), and what junior/mid/senior answers sound like. Practice it aloud twice before any design round; it generalizes to most "consumer app with offline + gamification" prompts.

## Step 1 — Requirements (5 min; the step juniors skip)

Say: functional — play lessons, earn XP, keep streaks, lose/regain hearts, work offline on mobile, sync across devices, guest mode. Non-functional — solo-dev operability, ~zero cost, correctness of streaks across timezones, no data loss offline. Explicitly out: social, realtime, speech.

- Junior: jumps to tables.
- Mid: lists functional + a few non-functional.
- Senior: extracts the *shaping* constraints — "offline + multi-device means we need conflict-free sync; that decision dominates everything else." (This repo's spec did exactly that: CON-01..04, [SPEC.md](../../../SPEC.md).)

## Step 2 — API sketch (5 min)

Propose few endpoints: auth trio, content manifest/bundles, one batch `POST /sync`, `GET /me`. What the repo chose — identical ([app.ts#L21-L26](../../../apps/api/src/app.ts#L21-L26)), with `/sync` as the *only* progress write path (API-01).

- Junior: REST per resource (`POST /lesson-completions`, `PUT /hearts`) — now every endpoint needs offline handling.
- Mid: consolidates writes into `/sync`, mentions idempotency.
- Senior: says *why* one write path: one place for authn, validation, idempotency, and audit; reads are derived. Names the alternative (per-resource CRUD) and when it's better (server-authoritative apps).

## Step 3 — Data model (10 min)

Propose: `users`, `refresh_tokens`, `progress_events(user_id, id, type, payload, occurred_at)` with PK `(user_id, id)`. Content as versioned immutable artifacts, not rows. Derived state computed by a shared reducer.

Repo evidence: [schema.ts](../../../packages/db/src/schema.ts#L41-L59), [reduceEvents](../../../packages/core/src/events.ts#L49-L86), [compile.ts](../../../packages/content/src/compile.ts).

- Junior: `users.xp`, `users.hearts` columns updated in place — then offline sync becomes conflict resolution on mutable state (hard mode).
- Mid: event log + idempotency key; can explain replay safety.
- Senior: adds the *invariants* — reducer must be order-independent and clamp untrusted time; names the costs (eternal event compat, O(history) reads) and the snapshot escape hatch keyed by last event id. Stronger/simpler alternative to volunteer: if offline weren't required, plain rows + optimistic locking is *less* code — the design follows the requirement, not the aesthetic.

## Step 4 — Client architecture (10 min)

Propose: pure rules engine shared across platforms; thin UIs; outbox for offline writes; baseline+delta overlay for display.

Repo evidence: [packages/core](../../../packages/core/src), outboxes ([web](../../../apps/web/src/lib/progress.tsx#L80-L124) / [mobile](../../../apps/mobile/src/lib/storage.ts#L42-L66)), overlay param ([events.ts#L49-L56](../../../packages/core/src/events.ts#L49-L56)).

- Junior: fetch-on-render, spinner-driven.
- Mid: local-first reads, queued writes, background sync triggers.
- Senior: names the consistency model out loud ("eventually consistent, converging because replay is idempotent and folding is order-independent") and the crash-safety ordering (persist event → ack → clear).

## Step 5 — The hard tidbits interviewers poke (have these ready)

| Poke | The answer this repo embodies |
| --- | --- |
| "Streaks across timezones?" | store IANA tz per user; day = local day of *event time*; device timestamps, not server receipt ([streak.ts#L14-L21](../../../packages/core/src/streak.ts#L14-L21), GAM-02) |
| "Clock tampering?" | server clamps future timestamps ([sync.ts#L56-L57](../../../apps/api/src/routes/sync.ts#L56-L57)); backdating remains — acknowledge honestly, gate on social features |
| "Lives regen without cron?" | lazy derivation from timestamps ([hearts.ts#L18-L27](../../../packages/core/src/hearts.ts#L18-L27)) |
| "Two devices, same user, both offline?" | both logs merge; dedupe by event id; fold converges — demo with the [order-independence test](../../../packages/core/src/events.test.ts#L23-L29) |
| "Cheating?" | client-trusted today (bounded by zod); server-derived XP plan staged log-only→enforce ([critique #3](../../03-architecture-and-patterns/06-architecture-critique.md)) |

## Variation prompts (practice each for 10 minutes)

1. **"Add multi-tenancy (classrooms)."** Tenant column everywhere + membership/roles; structural single-owner scoping ([validation doc](../../03-architecture-and-patterns/03-validation-auth-and-permissions.md)) gets replaced by explicit authz; cross-tenant tests become CI-critical. Senior extra: teacher-reads-student is the first *cross-user* read — design the permission model before the endpoint.
2. **"Add real-time (live leaderboard during group practice)."** Don't reach for WebSockets first: define staleness budget; polling on focus may pass. If truly live: server aggregates events (needs server-derived XP first — dependency you can *name*), pushes deltas via SSE; the event log is already the pub source.
3. **"10x users."** Read path: snapshot table ([project P1](../../06-contribution-practice/03-senior-build-projects.md)); content is CDN-shaped already (immutable). Write path: `/sync` is append-only inserts — Postgres handles enormous append volume; partition `progress_events` by user hash when needed. Name the *first* bottleneck honestly: derive-on-read, with its trigger metric.
4. **"Add speech grading."** On-device model (privacy, offline, cost per spec NG-01); new exercise type = union member + new event fields (additive!); grading confidence thresholds are product decisions — show the [exercise union](../../../packages/core/src/types.ts#L108-L114) as the extension seam.

## Self-grade rubric

Basic: you produced the four artifacts (requirements, API, schema, client) in 40 min.
Solid: each artifact came with one tradeoff and the repo-anchored justification.
Strong: you volunteered an invariant ("fold must be order-independent"), one failure mode with mitigation (clock tampering), one honest debt (derive-on-read) with a trigger metric — unprompted.

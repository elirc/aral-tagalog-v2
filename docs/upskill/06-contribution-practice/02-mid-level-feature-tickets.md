# Mid-Level Feature Tickets

10 cross-layer tickets. **Rule: write a half-page design note before coding** (goal, approach, alternatives rejected, risk, rollback, test plan). Each ticket lists Risk & Rollback explicitly — practice writing those sections until they're reflexive.

## M1: API integration test suite
Difficulty: Medium — 1–2 days. Skills: test harness design, Postgres isolation.
Story: As a maintainer, I need `/auth/*` and `/sync` covered so refactors are safe. The single most valuable change possible in this repo ([critique #1](../03-architecture-and-patterns/06-architecture-critique.md)).
Plan: recipe 4–7 in [writing-tests-here](../05-quality-engineering/02-writing-tests-here.md); test DB via `TEST_DATABASE_URL`; truncate between tests; cover: register/login/refresh rotation & reuse, sync idempotency replay, missing-auth 401 table, clamp behavior.
Risk: low — new files only. Rollback: delete the folder.
Rejection risk: tests hitting the dev DB (data loss!) — the harness must refuse to run without an explicit test URL.
Interview story potential: "I introduced the first integration suite; the idempotency golden test."

## M2: Single-source event schemas (zod in core)
Difficulty: Medium — 1 day + M1 recommended first. Skills: contract ownership, type inference.
Story: As a maintainer, event shape must be defined once. Today: TS in [events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31), zod duplicated in [sync.ts#L8-L32](../../../apps/api/src/routes/sync.ts#L8-L32).
Design note must cover: zod becomes a core dependency (bundle-size impact on clients — measure; zod is ~13kb gzip — acceptable? state it), types via `z.infer`, API imports schemas.
Risk: subtle validation drift during swap. Rollback: revert; no data shape changes.
Test: existing zod bounds re-asserted via M1 suite; typecheck proves inference parity.
Interview story: "eliminated a dual-maintenance contract; discussed dependency-weight tradeoffs."

## M3: Server-derived XP (anti-cheat groundwork)
Difficulty: Medium-Hard — 2–3 days. Skills: trust boundaries, staged rollout.
Story: As a maintainer, XP must be computable server-side before any social feature ([critique #3](../03-architecture-and-patterns/06-architecture-critique.md) has the full plan — this ticket implements phase 1: log-only divergence).
Plan: API loads bundle at boot (it already serves it — [content routes](../../../apps/api/src/routes/content.ts)); on sync, compute expected xp from `lessonId` + `perfect` via core's [`lessonXp`](../../../packages/core/src/xp.ts#L6-L8); log mismatches; enforce later behind env flag.
Risk: bundle/lesson missing for old events → must tolerate unknown lessonIds forever. Rollback: flag off.
Test: forged-xp sync in M1 suite asserting the log line/flagged behavior.
Interview story: "measure-then-enforce rollout of a trust-boundary change."

## M4: Streak freeze item
Difficulty: Medium-Hard — 3 days. Skills: event modeling, derived state, product logic.
Story: As a user, I can earn/spend a streak freeze that preserves a missed day.
Design note: new event types (`freeze_earned`, or derive earning from streak milestones — *chose which and defend it*); reducer changes in [events.ts](../../../packages/core/src/events.ts#L49-L86) + [streak.ts](../../../packages/core/src/streak.ts#L30-L37); back-compat: old clients ignore unknown event kinds? **They don't** — [zod would reject on sync](../../../apps/api/src/routes/sync.ts#L8-L32) and old clients' reducers would break on unknown types in *their* storage only if written by new clients on shared account. This ticket forces you through real event-versioning pain — that's why it's here.
Risk: cross-version event compatibility. Rollback: stop emitting; old events remain inert.
Test: core unit tests (gap coverage: freeze covering exactly one missed day; expiry).
Interview story: "evolved an event-sourced schema with old clients in the field."

## M5: Review/practice queue — "weakest words"
Difficulty: Hard — 3–5 days. Skills: derived views, algorithm choice restraint.
Story: As a learner, practice mode should target my worst exercises, not whole-lesson replay.
Design: mistakes aren't currently recorded per-exercise! `hearts_lost` has no exercise id ([events.ts#L24-L27](../../../packages/core/src/events.ts#L24-L27)). So: extend event (additive `exerciseId?`), emit from players, derive a weakness map in core, new practice screen consuming it. Explicitly reject SM-2 spaced repetition for v1 (spec OQ-02) — scope discipline is part of the exercise.
Risk: event size growth; privacy-neutral. Rollback: field optional forever.
Test: reducer unit tests; manual play-through.
Interview story: "designed an additive event evolution to unlock a feature the original schema couldn't express."

## M6: Web PWA offline play
Difficulty: Hard — 1 week. Skills: service workers, cache strategy.
Story: As a web user, lessons should survive a dropped connection (spec ARCH-05 "optional PWA later").
Design note must answer: what's cached (app shell + bundle + audio), what isn't (auth), how updates roll (bundle version check mirrors [mobile content.ts#L21-L33](../../../apps/mobile/src/lib/content.ts#L21-L33)), and how localStorage outbox already gives you offline *writes* for free.
Risk: stale-cache bugs are the classic PWA tax — version everything. Rollback: unregister SW.
Interview story: "brought mobile's offline model to web; cache-invalidation by immutable versioning."

## M7: Leaderboard (weekly XP, friends-free v1)
Difficulty: Hard — 1 week; **requires M3 enforced first** (say why in your note or fail the ticket).
Design: server-side weekly aggregation over events (first real use of [(user_id, occurred_at) index](../../../packages/db/src/schema.ts#L58)); pagination; display-name policy ([users.displayName](../../../packages/db/src/schema.ts#L18) exists, unused).
Risk: performance (first cross-user query) + privacy (opt-in?). Rollback: feature flag.
Interview story: "the feature that forced trust + aggregation + privacy decisions at once."

## M8: Refresh-token reuse detection
Difficulty: Medium — 2 days. Skills: auth hardening.
Story: from [trace 3](../04-code-reading-gym/02-trace-tables.md) — detect stolen-token use.
Design: keep rotated rows with `rotatedAt` + `familyId` instead of deleting ([routes/auth.ts#L54-L55](../../../apps/api/src/routes/auth.ts#L54-L55)); use of a rotated token revokes the family. Migration: additive columns; expiry-based cleanup.
Test: M1 suite — reuse scenario asserting family revocation.
Interview story: textbook auth-hardening narrative with a schema migration.

## M9: Content delta updates for mobile
Difficulty: Medium-Hard — 3 days. Skills: versioned artifacts, bandwidth budgets.
Story: As a mobile user on metered data, don't re-download the whole bundle per version (spec OFF-04 mentions deltas; current code fetches full — [mobile content.ts#L21-L33](../../../apps/mobile/src/lib/content.ts#L21-L33)).
Design: compiler emits per-version diffs (changed lessons only) + full fallback; client applies or falls back. Honestly evaluate: is bundle size (~100–200KB) worth this yet? A legitimate outcome is a written **no** with the trigger metric — that outcome scores *higher*.
Interview story: "argued against my own ticket with numbers" — genuinely senior.

## M10: Guest→account merge policy
Difficulty: Medium — 2 days. Skills: product-edge reasoning, idempotency.
Story: A user plays as guest on two devices, then logs into the same account from both. Both outboxes sync — streaks/hearts merge via reducer (fine), but XP double-earns for the *same lessons played twice as different guests* (legitimate? decide!). Write the policy, then verify code matches or fix.
Read first: [adoptAuth (web)](../../../apps/web/src/lib/progress.tsx#L117-L124), reducer completion semantics ([events.ts#L64-L71](../../../packages/core/src/events.ts#L64-L71)).
Interview story: "found an unspecified merge edge and drove it to a written decision."

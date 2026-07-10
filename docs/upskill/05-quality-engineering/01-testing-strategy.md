# Testing Strategy — unit, integration, E2E, and what runs today

## What exists (verified 2026-07-09)

| Layer | Framework | Location | Count | Runs via |
| --- | --- | --- | --- | --- |
| **Unit — pure logic** | Vitest | [packages/core/src/*.test.ts](../../../packages/core/src) | 27 tests / 5 files | `pnpm --filter @aral/core test` ✅ |
| Content validation | the compiler itself | [compile.ts](../../../packages/content/src/compile.ts) exits 1 on invalid YAML | build-time gate | `pnpm content:build` ✅ |
| Typechecks | tsc strict | every package | — | `pnpm -r typecheck` ✅ |
| API integration | — | **none** | 0 | manual curl smoke only |
| Web component/E2E | — | **none** | 0 | — |
| Mobile | — | **none** | 0 | — |
| CI | — | **no CI config exists** (no `.github/workflows`) | — | — |

That last row matters: today *nothing* runs tests automatically. First infrastructure ticket in [good-first-tickets](../06-contribution-practice/01-good-first-tickets.md) is a GitHub Actions workflow: install → content:build → typecheck → test.

## The test pyramid, mapped to this repo

```
        E2E (none — future: Playwright web lesson-play; Maestro mobile)
      Integration (none — future: API routes against real Postgres)
    Unit: packages/core — 27 tests, milliseconds, zero mocks   ← the base exists and it's good
  Static: TS strict + zod boundaries + content compiler        ← underrated layer, very strong here
```

**What belongs at each layer (transferable):**
- *Unit*: rules, math, state machines — anything pure. Evidence this repo got it right: hearts boundary math ([hearts.test.ts#L20-L27](../../../packages/core/src/hearts.test.ts#L20-L27)), streak timezone behavior ([streak.test.ts#L5-L12](../../../packages/core/src/streak.test.ts#L5-L12)), reducer order-independence ([events.test.ts#L23-L29](../../../packages/core/src/events.test.ts#L23-L29)). None of these need a DB or a browser — and testing them *through* a browser would be slow and flaky.
- *Integration*: contracts + wiring — "does `/sync` really dedupe against real Postgres constraints?" The composite-PK behavior ([schema.ts#L57](../../../packages/db/src/schema.ts#L57)) can ONLY be truly tested at this layer; a mocked DB would test your mock.
- *E2E*: a handful of user journeys (play a lesson, sign up, out-of-hearts). Not one per exercise type — that's unit territory via the engine.

**What NOT to test:** framework behavior (React renders what you return), zod itself, styles, exact copy. And don't unit-test the clients' store logic *through the UI* — extract-then-test is cheaper (see the refactor kata).

## Why core tests are this fast and stable — steal these properties

1. **No mocks anywhere.** Verified: `rg "vi\.(mock|fn|spyOn)" packages/core` → no hits. Achieved by design (pure functions), not testing skill. When you need lots of mocks, that's the code telling you where the boundary should have been.
2. **Time is a parameter.** `reduceEvents(events, tz, now)` ([events.ts#L49-L54](../../../packages/core/src/events.ts#L49-L54)); tests pin `now` to constants ([events.test.ts#L5-L6](../../../packages/core/src/events.test.ts#L5-L6)). No fake timers, no flake. Same trick for randomness: the content shuffle is seeded ([compile.ts#L31-L47](../../../packages/content/src/compile.ts#L31-L47)) — deterministic outputs, snapshot-diffable.
3. **Tests state invariants, not implementations.** [hearts.test.ts#L38-L41](../../../packages/core/src/hearts.test.ts#L38-L41) asserts "no regeneration when time goes backwards" — a property that survives refactors. Compare with brittle style: asserting internal `updatedAt` arithmetic on every step.
4. **Fixtures are builders, minimal:** lesson literals inline in [session.test.ts#L7-L15](../../../packages/core/src/session.test.ts#L7-L15) — small enough to read, no shared mega-fixture coupling tests together.

## Flake prevention checklist (interview-ready)

- Clock → inject `now` (done here) or fake timers (last resort).
- Randomness → seed it (done in compiler) or inject.
- Network/DB in unit tests → you're in the wrong layer; move down (pure) or up (integration) honestly.
- Order dependence → each test builds its own state (each `it` here constructs its own session/events).
- Await every promise; no `setTimeout` sleeps in tests.

## Drill

Classify these five hypothetical tests into unit / integration / E2E / don't-write, with one sentence each: (a) "perfect lesson awards 15xp", (b) "replaying a sync batch doesn't double xp", (c) "the Check button disables while feedback shows", (d) "zod rejects a 501-event batch", (e) "argon2 hashes verify". Answers: a=unit (exists: [session.test.ts#L17-L28](../../../packages/core/src/session.test.ts#L17-L28)); b=integration (PK behavior — top missing test); c=component/E2E, low priority; d=unit-able against the zod schema directly *if schemas move to core* — note how architecture changes testability; e=don't (testing the library) — but one smoke assertion in an auth integration test is fine.

Interview angle: "How do you decide what to test?" → the pyramid table + the no-mocks story. "How do you prevent flaky tests?" → the checklist with the `now`-parameter anchor. → [debugging & review rounds](../08-interview-prep/05-debugging-and-code-review-rounds.md)

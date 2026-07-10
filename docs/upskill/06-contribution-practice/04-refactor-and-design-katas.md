# Refactor & Design Katas

Judgment reps. Do them on branches you throw away; the artifact is your written reasoning. Self-grading criteria per kata.

## Kata A: Heal the boundary leak (schema ownership)
Move the event zod schemas from [sync.ts#L8-L32](../../../apps/api/src/routes/sync.ts#L8-L32) into `packages/core`, infer the TS types, and make the API import them. Constraint: zero behavior change, proven by… what? (You have no API tests — so first write the two zod snapshot tests that pin current accept/reject behavior, *then* move.)
Self-grade — Strong: you sequenced test-then-move without being told twice, and your PR note mentions zod entering core's dependency tree as a decision, not a footnote.

## Kata B: Outbox eventing change — add `synced_at` acknowledgment info client-side
Change the web outbox from "delete on ack" to "mark + prune," enabling a "recently synced ✓" UI. Files: [progress.tsx#L88-L112](../../../apps/web/src/lib/progress.tsx#L88-L112). The trap: the baseline-overlay invariant (outbox must contain *only* unsynced events or you double-count — [pattern 6](../03-architecture-and-patterns/05-pattern-catalog.md)).
Self-grade — Strong: your design keeps the reducer input = strictly-unsynced subset, with marked events excluded, and you wrote the double-count regression test first.

## Kata C: Split a module — `progress.tsx` is three things
Web's store file mixes storage I/O, sync policy, and React context (~161 lines). Split into `storage.ts`, `sync.ts`, `ProgressProvider.tsx` without changing behavior. Measure: can you now unit-test sync policy with a fake storage in vitest, no DOM?
Self-grade — Strong: the React file ends up <60 lines and imports the other two; policy tests exist; no `window` references outside storage.

## Kata D: Remove duplication with judgment — the two `TapsView`s
[web](../../../apps/web/src/components/exercises/TapsView.tsx) and [mobile](../../../apps/mobile/src/components/exercises/TapsView.tsx) share tap-selection logic (picked indices, update fn) but different rendering. Extract *only* the state logic into a shared hook (`useTapAnswer` in core? in a new `packages/ui-logic`? — where it lives is the actual question; core currently has zero React dependency and adding one is a big deal).
Self-grade — Strong: you either created a deliberate new home (documented) or decided the ~15 duplicated lines don't justify a new package — *with the drift-cost argument written down*. Both conclusions can be Strong; "extract because DRY" alone is Basic.

## Kata E: Improve type safety — kill the `as unknown as CourseBundle`
[web content.ts#L9](../../../apps/web/src/lib/content.ts#L9) double-casts the imported JSON. Options: zod-parse at startup (runtime cost, real validation), a generated `.d.ts` from the compiler, or keep-with-comment. Prototype the zod option; measure startup cost.
Self-grade — Strong: you noticed the compiler *already validates* this artifact at build time, so runtime re-validation guards only against artifact/code version skew — and sized that risk honestly.

## Kata F: Design a migration — hearts regen 4h → dynamic per-user
Product wants regen speed as a paid perk someday. Today `HEART_REGEN_MS` is a constant baked into a *pure shared function* ([hearts.ts#L2](../../../packages/core/src/hearts.ts#L2)) used by clients and reducer alike. Design: where does the rate live (user state? event-carried?), how do offline clients learn it, what happens to *historical* regen when the rate changes mid-stream (reducer replays old events under which rate?). Write the design note; no code.
Self-grade — Strong: you caught that replaying history under a new rate rewrites the past, and proposed rate-change-as-event so the fold applies the right rate per era. That's event-sourcing maturity.

## Kata G: Write the RFC — offline web (project M6) 
One page, using the [RFC template](../07-career-and-collaboration/02-writing-prs-and-rfcs.md). Hard requirement: a "what we will NOT do" section and a kill-criterion ("we abandon this if…").

## Kata H: Review the flawed PR
Take [review kata 2's diff description](../04-code-reading-gym/04-review-katas.md) (backoff loop in an effect) and *write the corrected implementation sketch yourself* — backoff as a pure, tested helper + trigger integration. Compare with your kata-2 review comments: did your review actually describe the fix you now built? Reviews that can't be cashed into implementations were vibes.

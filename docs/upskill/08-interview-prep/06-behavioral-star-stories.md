# Behavioral STAR Stories

9 worksheets sourced from this repo's tickets/projects and the act of studying it. Fill Action/Result with *your* specifics after doing the work — the scaffolding here gives Situation/Task and the senior-signal details to hit. Rehearsal bar: under 2 minutes, concrete, ends with impact.

## Story 1: Learning a complex codebase fast
Prompts: "Tell me about ramping up on unfamiliar code" / "How do you approach a new codebase?"
Source: this curriculum's cartography track.
S: Joined/studied an offline-first learning-app monorepo (6 workspaces, 3 runtimes). T: become productive in days. A: mapped entry points → contracts → state → side effects; traced six end-to-end flows; wrote anchors instead of notes ([key flows](../../01-codebase-cartography/05-key-flows.md) method). R: e.g., "found two latent defects (batch-size mismatch, register race) before writing a line of feature code."
Evidence: your annotated flow docs.
Senior signals: a *method*, not heroics; found risks while reading.
Resume bullet: "Mapped and documented a 3-runtime monorepo's core flows; surfaced 2 latent defects via systematic code reading."

## Story 2: The tooling bug that blocked everything (duplicate @types/react)
Prompts: "Hardest debugging" / "A time you were blocked."
Source: real incident, [tooling doc](../../02-stack-and-language-mastery/04-tooling-and-build-system.md).
S: web typecheck broke with unintelligible type errors after adding the mobile app. T: unblock the monorepo. A: recognized the two-copies signature, proved with `pnpm why`, fixed with a root override, documented the diagnostic. R: green typechecks; a written playbook for the failure class.
Senior signals: pattern recognition + prevention artifact.
Resume bullet: "Diagnosed cross-workspace type-identity conflicts in a pnpm monorepo; instituted version-override policy."

## Story 3: Making a risky change safe (event schema evolution)
Prompts: "A change you were nervous about" / "Backwards compatibility."
Source: ticket M4/M5 (event evolution) once done.
Hit: old events are immortal in three storage systems; additive-only discipline; staged rollout.
Senior signals: named the contract nobody had written down; chose compat over cleanliness.

## Story 4: Disagreeing with a design (Redis cache review)
Prompts: "Disagreed with a teammate" / "Pushed back on a decision."
Source: [review sim 2](05-debugging-and-code-review-rounds.md).
A-template: asked for the p95 measurement; showed the drift class the architecture avoids; proposed snapshot-keyed-by-event-id as the future-proof alternative; agreed on a trigger metric rather than a veto. R: decision deferred *with criteria* — conflict converted to policy.
Senior signals: evidence over opinion; a "no" that left a path to "yes."

## Story 5: Shipping the first tests where none existed
Prompts: "Improved engineering quality" / "Initiative."
Source: ticket M1 (API integration suite) once done.
Hit: idempotency golden test as the crown jewel; refusing to run against dev DB; CI wiring (ticket 1).
Resume bullet: "Introduced first API integration suite (auth rotation, sync idempotency) + CI for a previously untested service."

## Story 6: A mistake and what changed after
Prompts: "Tell me about a mistake."
Source: honest candidate — pick your real one from doing the tickets (e.g., your ticket-7 first attempt broke old-client tolerance; you caught it via the PR-risks drill).
Structure the recovery: detected how → contained how → prevented how (test/checklist line item). Interviewers grade the *system* you built after, not the sin.

## Story 7: Ambiguity — the guest-merge policy (M10)
Prompts: "Ambiguous requirements" / "Drove a decision."
S: two-device guest merge had no specified behavior. A: enumerated cases, wrote the one-pager, got a decision, encoded it as tests. R: undefined behavior became documented product policy.
Senior signals: surfaced the decision instead of silently picking; tests as the decision's enforcement.

## Story 8: Performance judgment — the benchmark that said "don't optimize"
Prompts: "Improved performance" (subverted).
Source: [perf drill](../../05-quality-engineering/04-performance-thinking.md) — you measured reduceEvents at 100k events and *declined* to add caching, documenting the trigger metric.
Senior signals: measurement over instinct; knowing when not to build. Interviewers remember this story because it's rare.

## Story 9: Teaching/mentoring — the teach-back
Prompts: "Helped someone grow" / "Explained something complex."
Source: fast-track teach-back or walking a peer through the sync design.
Hit: chose the *one* organizing idea (event log) and built everything from it; checked understanding with a prediction question ("what happens on replay?").
Resume bullet: "Onboarded peers to an event-sourced sync architecture via flow-trace walkthroughs."

---

Mapping table (prompt → story): conflict→4 · ambiguity→7 · mistake→6 · technical depth→2/3 · leadership/initiative→5 · learning speed→1 · judgment→8 · mentoring→9.

Rehearsal check per story: Under 2:00? Concrete nouns (file, number, metric)? Ends with impact + what persisted (test, doc, policy)? One senior-signal sentence you can point to?

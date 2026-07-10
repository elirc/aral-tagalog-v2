# Systematic Debugging

The method: **reproduce → narrow (binary-split the system) → hypothesize → test the hypothesis cheaply → fix the root cause → add regression coverage.** The discipline is refusing to "try things" before you can reproduce, and refusing to close without a regression test.

Tools actually available in this repo: browser devtools (Network/Application tabs — localStorage keys `aral.*`), Fastify's built-in pino logging (already on: [app.ts#L17](../../../apps/api/src/app.ts#L17)), `psql`/any client against localhost:5433, vitest watch mode, `console.log` in the reducer (it's pure — log-and-rerun is deterministic), React DevTools.

---

## Scenario 1: "My streak reset even though I practiced yesterday"

Reproduction: user in tz `Asia/Manila`, completed a lesson 2026-07-08 23:50 local; today shows streak 0.
First question: is the bug in *event data* (wrong `occurredAt`) or *derivation* (wrong day-key math)?
Narrowing path: 1. Pull the user's events (`SELECT occurred_at, payload FROM progress_events WHERE user_id=...`). 2. Compute `localDayKey(occurredAt, tz)` by hand for the suspect event. 3. If the key says 07-08, derivation is suspect → unit-test [applyCompletionDay](../../../packages/core/src/streak.ts#L30-L37) with those exact values. 4. If the key says 07-09, the *client clock or tz* wrote a wrong timestamp → check device tz vs stored `users.tz` ([me PATCH](../../../apps/api/src/routes/me.ts#L19-L27) — was it ever set, or defaulted to UTC at [register](../../../apps/api/src/routes/auth.ts#L28)?).
Useful probes: a scratch vitest file calling `reduceEvents` with the user's real event JSON — pure functions make production data replayable locally. That superpower is *why* the architecture matters; say so.
Likely root causes: `tz` defaulted to UTC at registration (web sends it — [AuthForm→register](../../../apps/web/src/components/AuthForm.tsx#L24-L26) — but a client that omits it silently gets UTC).
Regression test to add: streak test with a 23:50+08:00 completion and tz UTC vs Manila, asserting different day keys ([streak.test.ts](../../../packages/core/src/streak.test.ts) pattern exists at [#L5-L12](../../../packages/core/src/streak.test.ts#L5-L12)).
Senior lesson: timezone bugs are almost always *data* bugs (which tz was stored/used) rather than *math* bugs. Look at inputs before formulas.
Interview version: narrate the binary split — "data or derivation" — then the replay-in-vitest trick. Interviewers reward the *method*, not the answer speed.

## Scenario 2: "XP shows 45 on my phone, 30 on the web"

Reproduction: same account, both online.
First question: which one agrees with the server (`GET /me`)?
Narrowing: 1. curl `/me` → say it returns 30. 2. Phone shows 45 ⇒ phone has 15 xp of *unsynced local events* (baseline 30 + outbox overlay — by design! [mobile progress.tsx#L52-L55](../../../apps/mobile/src/lib/progress.tsx#L52-L55)) or a stuck outbox. 3. Inspect outbox: unsynced rows present? → why didn't sync fire: offline? 401 loop? server rejecting the batch (zod)? 4. Check API logs for the POST — pino logs every request.
Likely root causes: (a) legitimately pending sync — not a bug, a *product-communication* gap; (b) a poisoned outbox event failing zod forever → the whole batch 400s eternally ([sync.ts#L42-L44](../../../apps/api/src/routes/sync.ts#L42-L44) rejects the entire batch — **real design weakness found via debugging**: one bad event blocks all).
Fix root cause for (b): server accepts valid events and reports rejects per-event, or client quarantines poison events.
Regression: integration test posting a batch with one invalid event, asserting partial acceptance (after the fix defines semantics).
Senior lesson: "displays disagree" in an eventually-consistent system is *expected state or stuck pipe* — instrument the pipe (outbox depth) before touching math.
Interview version: this is a distributed-systems question wearing a UI costume; name "eventual consistency" and "poison message" out loud.

## Scenario 3: "Register returns 500 sometimes in a load test"

Reproduction: 50 parallel registrations of the same email; a few 500s among 409s.
First question: app logic or DB constraint race?
Narrowing: 1. API logs show unique-violation from Postgres. 2. Read [routes/auth.ts#L20-L23](../../../apps/api/src/routes/auth.ts#L20-L23): check-then-insert — two requests pass the check, one insert loses. TOCTOU (time-of-check/time-of-use).
Cheap hypothesis test: two concurrent curls in a shell loop.
Fix root cause: rely on the DB constraint as the source of truth — catch the unique-violation error code (`23505`) and return 409. The pre-check becomes an optimization, not the guard.
Regression: integration test with `Promise.all` of two registers; assert exactly one 201 and one 409, never 500.
Senior lesson: any check-then-act across requests is a race; the database's constraint *is* the serialization point. Interviewers ask this exact pattern constantly.

## Scenario 4: "Lesson audio never plays, no errors anywhere"

Reproduction: any exercise's speaker button; silence; console clean.
First question: is a request even made?
Narrowing: 1. Network tab → request to `/content/audio/kumusta_ka.mp3` → 404. 2. Is that a server bug or missing file? Hit it with curl; check `packages/content/audio/en-tl/` — empty (no recordings exist yet; compiler warned: "83 audio refs have no recording"). 3. Silence is *designed*: [`playAudio` swallows](../../../apps/web/src/lib/audio.ts#L8-L14).
Root cause: not a bug — a product state with zero observability. The fix is a decision: keep silent + add a dev-mode console.warn + a metric, or show a muted icon.
Regression: none (no defect), but add the drill from [pattern 13](../../03-architecture-and-patterns/05-pattern-catalog.md).
Senior lesson: "no error" plus "no effect" = intentional swallow somewhere; grep for empty `catch` before suspecting the stack. `rg "catch \{" apps/web` finds them in seconds.

## Scenario 5: "After deploying new content, some users' next lesson is locked"

Reproduction: v2 bundle removed lesson `greetings-3` (merged into `greetings-2`); users who had completed through `greetings-2` now see everything locked after it.
First question: data loss or derivation change?
Narrowing: 1. `/me` still lists `greetings-3`?? No — users completed only up to `greetings-2`; the *removed* id isn't the issue for them. Reproduce precisely: the broken users completed `greetings-1..2` and old `greetings-3`. 2. Read [`isLessonUnlocked`](../../../apps/web/src/lib/content.ts#L20-L33): it walks *current* content; completion of a deleted lesson is ignored harmlessly, BUT a user who had completed only up to old `greetings-3` now lacks completion of new `greetings-3` (different exercises, same slot) — wait, ids… 3. The precise repro determines everything: the bug family is "unlock logic couples progression to content identity."
Likely root cause: content ids are load-bearing progression state; deleting/renaming ids strands users.
Fix root cause: content migration policy — never delete a lesson id within a course version family; or unlock by *count* completed in unit rather than exact chain.
Regression: a unit test over `isLessonUnlocked` with a completions list containing unknown ids.
Senior lesson: two systems (content artifacts, progress events) share an implicit **contract — stable lesson ids** — written down nowhere. Debugging surfaced an undocumented invariant; the durable fix is documenting + testing it, not patching one user.
Interview version: perfect "walk me through a hard bug" story — it has a non-obvious root cause, a systemic fix, and a lesson about implicit contracts.

---

Drill: pick scenario 3, actually build the two-concurrent-registers repro against your local stack, observe the 500, write the fix on a branch, and the regression test (needs recipe-4 harness or assert via curl). Timebox 90 minutes.
Self-grade — Strong: your fix catches the Postgres error code specifically (not a blanket try/catch) and the 409 body matches the existing duplicate-email response shape ([routes/auth.ts#L22](../../../apps/api/src/routes/auth.ts#L22)).

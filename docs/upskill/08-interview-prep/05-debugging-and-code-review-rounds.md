# Debugging & Code Review Rounds — timed simulations

Convert earlier drills into interview conditions. Rules: timer on, narrate *everything* aloud (interviewers grade the narration, not the fix), end each with "the regression test I'd add."

## Debugging sim 1 (25 min): "Streak reset overnight"

Setup: read only the scenario statement in [debugging scenario 1](../../05-quality-engineering/03-systematic-debugging.md), not the narrowing path. Solve aloud with the repo open.
Interviewer follow-ups to answer mid-stream: "What data would you look at first?" · "How do you rule out the reducer?" · "Your fix touches registration — who else sets tz?"
Grading rubric — narration named a binary split in the first 3 minutes (data vs derivation) /10; used the pure-function replay trick /10; regression test specific (file + case) /10. 21+ = pass at mid-level.

## Debugging sim 2 (25 min): "Phone and web disagree on XP"

From [scenario 2](../../05-quality-engineering/03-systematic-debugging.md). The trap: it may not be a bug. Follow-ups: "Users are angry — what do you ship *today*?" (sync-status indicator, [ticket 4](../../06-contribution-practice/01-good-first-tickets.md)) · "What if the outbox contains an event the server always rejects?" (poison batch — the real defect).
Rubric adds: distinguished expected-eventual-consistency from stuck-pipe /10.

## Debugging sim 3 (20 min): "Load test shows 500s on register"

From [scenario 3](../../05-quality-engineering/03-systematic-debugging.md). This one you should *drive to a fix live* — the race is readable at [routes/auth.ts#L20-L31](../../../apps/api/src/routes/auth.ts#L20-L31).
Follow-ups: "Why not a mutex?" · "Which Postgres error code?" (23505 — knowing it exists matters more than memorizing it) · "Same bug shape elsewhere in this codebase?" (any future check-then-act; refresh rotation is delete-then-issue — safe because delete is the serialization point; explaining *why it's safe* is senior).

## Debugging sim 4 (15 min): "No audio, no errors"

From [scenario 4](../../05-quality-engineering/03-systematic-debugging.md). Short round; tests whether you check the Network tab before the code, and whether you can identify *designed* silence ([audio.ts#L8-L14](../../../apps/web/src/lib/audio.ts#L8-L14)) vs accidental. Follow-up: "Is fail-silent the right call? Defend, then attack."

## Review sim 1 (20 min): the daily-goal PR

[Kata 1](../../04-code-reading-gym/04-review-katas.md) under time. Deliver a verdict + max five comments aloud. Rubric: found the timezone split-brain /10; distinguished blocking vs important /5; comments propose directions, not demands /5; said what you didn't review /5.

## Review sim 2 (20 min): the Redis-cache PR

[Kata 3](../../04-code-reading-gym/04-review-katas.md). Tests saying **no** with grace and evidence. Rubric weighted on: asked for the measurement first /10; offered the better design (snapshot-by-event-id) instead of bare rejection /10.

## Review sim 3 (15 min): the token-refresh backoff PR

[Kata 2](../../04-code-reading-gym/04-review-katas.md). Follow-up escalation: "Author says 'it works in testing' — respond." (Kind, specific: unmount/logout scenario it can't have tested; propose the pure-helper split so it *can* be tested — [kata H](../../06-contribution-practice/04-refactor-and-design-katas.md).)

---

Run schedule: sims live in the [two-week cram plan](07-two-week-cram-plan.md). Record audio for at least sim 1 and review sim 1; listen for filler, missing narration, and whether you ever said "the invariant here is…" — aim to say it once per sim, honestly.

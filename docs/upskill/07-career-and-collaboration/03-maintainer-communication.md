# Maintainer Communication

Principle: **bring evidence and a proposed answer, not just a question.** Asking for help without outsourcing your thinking means showing what you tried, what you observed, and your current best hypothesis.

## Asking a question

```md
**Context:** implementing ticket 7 (per-event sync rejection).
**What I tried:** returning `{accepted, rejected}` per event; web client at
progress.tsx#L91 treats any 200 as "clear whole outbox".
**Question:** should the client only clear accepted ids (bigger change, both
platforms), or is dropping rejected events acceptable for v1?
**My lean:** clear-accepted-only; rejected events are quarantined with a warn.
```

Why it works: 30-second read, decision-ready, shows the code was actually read.

## Reporting a bug

```md
**Symptom:** concurrent duplicate registrations return 500 (expected 409).
**Repro:** `for i in 1 2; do curl -s -X POST :3001/auth/register -d '{...}' & done`
— ~1 in 3 runs.
**Evidence:** pino log shows Postgres 23505 unique violation.
**Suspected cause:** check-then-insert race at apps/api/src/routes/auth.ts#L20-L31.
**Proposed fix:** catch 23505 → 409 (constraint as source of truth). Happy to PR.
```

Minimal, reproducible, anchored, offer attached. This exact bug is real here — [debugging scenario 3](../05-quality-engineering/03-systematic-debugging.md).

## Proposing a feature

Lead with the user problem, size honestly, and *volunteer the smaller version*: "Full offline web is large (RFC-worthy); a first slice — cache the bundle + show stale-friendly UI — is a day. Want the RFC or the slice?"

## Responding to review

- Every comment gets a response: `Done`, `Done in <sha>`, or a respectful case for not doing it ("Kept as-is because X; happy to change if you feel strongly").
- Disagree with the *consequence*, not the person: "If we clear the whole outbox on partial failure we lose events — that's the case I'm worried about. Does the per-id version address your simplicity concern?"
- When wrong, say so fast and cheerfully. It buys you enormous credibility for the next disagreement.
- Batch pushes; don't force re-review per nit fixed.

## Triage instincts (for when you're the maintainer)

Reproduce → label (bug/feature/question) → size → link duplicates. A repro you wrote is worth ten comments; this repo's pure core makes most logic reports replayable as vitest cases in minutes ([debugging scenario 1's replay trick](../05-quality-engineering/03-systematic-debugging.md)).

Drill: write the bug report (template above) for the unlock-after-content-removal issue you proved in [annotation drill 9](../04-code-reading-gym/01-annotation-drills.md). Strong = it includes the one-line policy question the maintainer must answer ("are lesson ids append-only forever?") — surfacing the *decision*, not just the defect.

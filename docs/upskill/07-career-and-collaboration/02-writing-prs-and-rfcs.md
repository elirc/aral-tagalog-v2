# Writing PRs and RFCs

## PR description template (tuned for this repo)

```md
## What
One or two sentences of the change, user-visible first.

## Why
Link the ticket/issue; one sentence of motivation. If it deviates from an existing
pattern, name the pattern and the reason.

## How tested
- [ ] pnpm test (core) — pass/fail
- [ ] pnpm -r typecheck
- [ ] pnpm content:build (if content touched)
- [ ] Manual: exact steps + what you observed (screenshots for UI)
- [ ] New tests: file names

## Risks
Blast radius (which surfaces: core/api/web/mobile?); event or API contract changes
(these need back-compat notes — old clients exist); rollback plan.

## Follow-ups
Deliberately out of scope; tickets filed.
```

Commit messages: imperative summary ≤72 chars; body = why, not what ("the diff is the what"). This repo's history models it — read `git log`.

## When to RFC instead of PR

RFC when: a contract changes (`ProgressEvent`, `/sync` shape, bundle format), a dependency enters `packages/core`, a second implementation of an existing pattern appears, or rollback would be hard. PR-only when: the change is reversible and pattern-following. The test: *"could a reviewer meaningfully say no after the code exists?"* If no is expensive, write the doc first.

## RFC template (half page, tailored here)

```md
# RFC: [title]
Status: draft | accepted | rejected
Problem: what hurts, with anchors (file:line) and evidence.
Goal / Non-goals: bullet each; non-goals prevent scope rot.
Proposal: the design; data/contract changes explicit (before/after shapes).
Compatibility: old events? old mobile binaries? migration + rollback.
Alternatives rejected: at least two, each with the one reason.
Test & rollout plan: shadow/flagged/enforced stages if trust-related.
Kill criterion: what observation makes us stop.
```

Worked example to imitate: [architecture critique improvement #3](../03-architecture-and-patterns/06-architecture-critique.md) (server-side XP) is essentially an RFC seed — expand it as the [kata G drill](../06-contribution-practice/04-refactor-and-design-katas.md).

Drill: write the full PR description for [ticket 7 (per-event sync rejection)](../06-contribution-practice/01-good-first-tickets.md) *before* implementing it. Strong = your Risks section caught that the response shape change needs client tolerance (old clients treat any 200 as full success — is that safe? Answer: yes, `accepted` count was already advisory — but you had to check [progress.tsx#L91-L96](../../../apps/web/src/lib/progress.tsx#L91-L96) to know).

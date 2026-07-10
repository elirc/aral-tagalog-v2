# Learning Rubrics

Observable behaviors, not vibes. Grade yourself per skill; "Interview-ready" = you can demonstrate the mid column *aloud with a repo anchor* in under 2 minutes.

| Skill | Junior (observable) | Mid (observable) | Senior (observable) | Interview-ready check |
| --- | --- | --- | --- | --- |
| Codebase navigation | finds a named symbol with search | predicts which package owns a change before searching ([system-map drill](../01-codebase-cartography/01-system-map.md)) | ranks modules by blast radius; reads diffs top-down by risk | 90s architecture summary, no notes |
| TypeScript | fixes red squiggles | designs unions + narrowing; knows types erase → validates boundaries | owns contract-drift strategy (single-source schemas) | Q2/Q3 in [JS cards](../08-interview-prep/01-js-ts-node-deep-dive.md) at Mid line |
| React | builds working components | places state by ownership; explains effect lifecycles & keys | designs state architecture (context vs store) from render-cost evidence | [frontend Q1/Q2](../08-interview-prep/02-frontend-framework-questions.md) with anchors |
| API design | builds CRUD endpoints | designs idempotent, validated, scoped endpoints | consolidates write paths; designs error taxonomies & compat windows | explain `/sync` end-to-end incl. why one write path |
| Data modeling | tables mirror UI forms | separates facts from derived state; writes safe migrations | chooses storage model from consistency requirements; plans event evolution | [data cards Q5/Q6](../08-interview-prep/03-api-and-data-modeling-questions.md) at Mid |
| Testing | writes happy-path tests | picks the right layer; injects clock/seed; writes regression tests from bugs | designs harnesses; sets flake budgets; tests invariants over implementations | name this repo's top-3 missing tests, ranked, with reasons |
| Debugging | console.logs until it moves | reproduce → binary-split → hypothesis → cheap test; adds regression coverage | recognizes failure *classes* (race, poison, drift); fixes the class | pass sim 1 & 3 rubrics ([sims](../08-interview-prep/05-debugging-and-code-review-rounds.md)) |
| Security | knows the OWASP words | maps authn/authz/validation to actual lines; runs the pre-merge checklist | designs structural defenses (scoping-by-construction); threat-models features | walk the [checklist table](../05-quality-engineering/05-security-checklist.md) from memory, ordered |
| Async/reliability | awaits things | outbox/idempotency/retry vocabulary with a real trace | designs delivery semantics; names consistency model unprompted | "exactly-once" sentence + crash-point enumeration ([flow 5](../01-codebase-cartography/05-key-flows.md)) |
| Code review | spots style issues | verdict + prioritized findings + kind specific comments | reviews for invariants and future cost; says no with a path to yes | pass review sim 2 rubric |
| Communication | answers questions asked | writes decision-ready questions, PRs with risk sections | writes RFCs with kill criteria; converts conflict to policy | ticket-7 PR description drill ([PR guide](../07-career-and-collaboration/02-writing-prs-and-rfcs.md)) |

## Self-assessment protocol

Every two weeks: pick 4 rows, do each row's check cold, write ✅/❌ + one sentence of evidence. A row is *owned* only after two consecutive ✅s. Track in a personal log — the trend matters more than any snapshot.

## The meta-rubric (are you actually becoming mid-level?)

- You ask "what does this change commit us to?" before "how do I implement this?" at least once per ticket.
- Your PRs' Risk sections stop being empty rituals — reviewers start responding to them.
- You can name, for any function you wrote this week: its inputs' trust level, its invariant, and its failure mode. (The [annotation protocol](../04-code-reading-gym/README.md), turned inward.)

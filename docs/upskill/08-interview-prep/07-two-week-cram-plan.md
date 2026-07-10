# Two-Week Cram Plan

Assumes ~2.5h/day weekdays, 4h weekend days, interview at the end of week 2. Every session ends with 10 minutes of *speaking aloud* — silent prep doesn't transfer.

## Week 1 — build the evidence base

| Day | Work (repo) | Interview reps |
| --- | --- | --- |
| 1 | [Fast track](../00-fast-track.md) fully: run stack, trace 2 flows | teach-back aloud (the 90s architecture summary), recorded |
| 2 | [Key flows](../01-codebase-cartography/05-key-flows.md) 1–3 with trace tables | Q-cards: [JS deep-dive](01-js-ts-node-deep-dive.md) Q1–Q7 aloud |
| 3 | Key flows 4–6; [glossary](../01-codebase-cartography/03-domain-glossary.md) cover-test | JS Q8–Q14; note the 3 weakest, redo tomorrow |
| 4 | [Pattern catalog](../03-architecture-and-patterns/05-pattern-catalog.md) cards 1–7 + drills | [API/data cards](03-api-and-data-modeling-questions.md) Q1–Q6 |
| 5 | Pattern cards 8–14; [validation/auth doc](../03-architecture-and-patterns/03-validation-auth-and-permissions.md) | API/data Q7–Q12 + redo day-3 weak trio |
| 6 (wknd) | Do one real ticket end-to-end ([#1 CI](../06-contribution-practice/01-good-first-tickets.md) or [#12 register race](../06-contribution-practice/01-good-first-tickets.md) recommended — each mints a story) | write PR description per [template](../07-career-and-collaboration/02-writing-prs-and-rfcs.md) |
| 7 (wknd) | **Checkpoint** (below) + rest | [system design walkthrough](04-system-design-from-this-repo.md) once, untimed, open-book |

### Day-7 checkpoint (self-assessment — be harsh)
- [ ] 90-second architecture summary without notes, no filler words disaster
- [ ] Can whiteboard the sync flow (client outbox → /sync → fold → baseline) from memory
- [ ] 6/14 JS cards at "Mid" level or better, honestly graded
- [ ] One ticket merged-or-PR-ready with tests
If <3 boxes: week 2 drops the second ticket and doubles card reps.

## Week 2 — simulate and polish

| Day | Work | Interview reps |
| --- | --- | --- |
| 8 | [Frontend cards](02-frontend-framework-questions.md) all, aloud | [Debugging sim 1](05-debugging-and-code-review-rounds.md) **timed** |
| 9 | [Architecture critique](../03-architecture-and-patterns/06-architecture-critique.md) read + summarize aloud | System design **timed 40 min**, closed-book, then diff vs the walkthrough |
| 10 | [STAR worksheets](06-behavioral-star-stories.md): fill 1,2,4,8 with your specifics | rehearse each ≤2 min, recorded, twice |
| 11 | second ticket OR finish first PR | [Debugging sim 3](05-debugging-and-code-review-rounds.md) timed + [review sim 1](05-debugging-and-code-review-rounds.md) |
| 12 | weak-card sweep (everything below "Mid") | design variation prompts 1 & 3 (multi-tenancy, 10x), 10 min each |
| 13 (wknd) | full mock loop with a friend/rubber duck: 20m deep-dive + 40m design + 3 STAR | — |
| 14 | **Checkpoint 2** + rest. No new material. | skim your recordings; one final teach-back |

### Day-14 checkpoint
- [ ] Design walkthrough hits the Strong rubric line (invariant + failure mode + honest debt, unprompted)
- [ ] 4 STAR stories under 2 min with concrete evidence
- [ ] Both debugging sims passed rubric (21+/30)
- [ ] You can answer "what would you change in that codebase?" with the [critique's](../03-architecture-and-patterns/06-architecture-critique.md) top-3, ranked, with reasons

## Day-of kit
Openers you've earned: deep-dive → sync idempotency ([flow 2](../01-codebase-cartography/05-key-flows.md)); "recent hard bug" → story 2 or the register race; "what would you improve" → critique top-3; "questions for us?" → ask about *their* offline/consistency edges — you now genuinely have taste here.

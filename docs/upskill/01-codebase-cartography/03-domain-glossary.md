# Domain Glossary

Product and domain nouns, their precise meaning *here*, and where they live. Near-synonyms that will confuse you are flagged.

| Term | Meaning in Aral | Code home |
| --- | --- | --- |
| **Course** | One (base language → target language) pair, e.g. `en-tl`. The extensibility key for future languages. | [types.ts#L8-L20](../../../packages/core/src/types.ts#L8-L20), [course.yaml](../../../packages/content/course/en-tl/course.yaml) |
| **Bundle** | The compiled, versioned, immutable JSON artifact of a course (+ audio manifest). What clients actually consume. | [compile.ts#L160-L177](../../../packages/content/src/compile.ts), manifest at `packages/content/dist/manifest.json` (generated) |
| **Unit / Lesson / Exercise** | Hierarchy: course → units → lessons → 8ish exercises. | [types.ts#L30-L50](../../../packages/core/src/types.ts#L30-L50) |
| **Exercise types** | `choice`, `translate_taps`, `listen`, `match_pairs`, `fill_blank` — a discriminated union. | [types.ts#L108-L114](../../../packages/core/src/types.ts#L108-L114) |
| **Session** | One play-through of a lesson: a queue of exercise indices, mistakes counter, done flag. Pure data, no React. | [session.ts#L9-L33](../../../packages/core/src/session.ts#L9-L33) |
| **Practice** | Replaying an already-completed lesson. Costs no hearts; refills one on completion. Encoded as a flag on the completion event, *not* a separate event type. | [events.ts#L14-L23](../../../packages/core/src/events.ts#L14-L23), [LessonPlayer.tsx#L78-L110](../../../apps/web/src/components/LessonPlayer.tsx#L78-L110) |
| **ProgressEvent** | An immutable record of something the user did: `lesson_completed`, `hearts_lost`, `hearts_refilled`. Client-generated UUID = idempotency key. | [events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31) |
| **Outbox** | Locally persisted queue of events not yet accepted by the server. Web: localStorage array; mobile: SQLite table. | [progress.tsx#L21](../../../apps/web/src/lib/progress.tsx#L21), [storage.ts#L13-L18](../../../apps/mobile/src/lib/storage.ts#L13-L18) |
| **Baseline** | The last server-derived `UserProgress` snapshot a client holds; local unsynced events are overlaid on top of it. | [events.ts#L49-L56](../../../packages/core/src/events.ts#L49-L56) (`initial` param), [progress.tsx#L76](../../../apps/web/src/lib/progress.tsx#L76) |
| **Hearts** | Lives currency: max 5, −1 per mistake, +1 per 4h, refilled by practice (or ads later). Derived from timestamps, never ticked by a timer. | [hearts.ts#L1-L49](../../../packages/core/src/hearts.ts#L1-L49) |
| **Streak** | Consecutive local-calendar days with ≥1 completion. Uses the *device's* completion timestamp, not sync time. | [streak.ts#L14-L47](../../../packages/core/src/streak.ts#L14-L47) |
| **Vocab** | Dictionary entries shared across lessons so audio/translations aren't duplicated. | [vocab.yaml](../../../packages/content/course/en-tl/vocab.yaml), [types.ts#L22-L28](../../../packages/core/src/types.ts#L22-L28) |
| **Audio ref** | A string key (`kumusta_ka`) mapped by the bundle's manifest to a file path. Referenced, never inlined. | [types.ts#L18-L19](../../../packages/core/src/types.ts#L18-L19), [compile.ts#L149-L156](../../../packages/content/src/compile.ts#L149-L156) |
| **Word bank** | The tappable word chips for translate/listen exercises; auto-generated from answer words + `extra_words` if not authored. | [compile.ts#L51-L53](../../../packages/content/src/compile.ts#L51-L53) |

## Confusables

- **`UserProgress` vs `ProgressEvent`** — `ProgressEvent` is a fact ("lost a heart at t"); `UserProgress` ([events.ts#L33-L39](../../../packages/core/src/events.ts#L33-L39)) is derived state (current hearts). Facts are stored; state is computed. Mixing these up is the #1 way to misread this repo.
- **`lesson.xp` vs `event.xp`** — the lesson declares base XP ([types.ts#L37-L42](../../../packages/core/src/types.ts#L37-L42)); the completion event records what was actually awarded incl. perfect bonus. The server trusts the event value (bounded ≤100 by [sync.ts zod](../../../apps/api/src/routes/sync.ts#L8-L18)) — see the risk register.
- **"practice" vs "review"** — the spec says "practice/review session"; the code only has the `practice` flag. There is no separate review-mode engine.
- **`ng` vs `nang`** — a Tagalog grammar pair the grader can treat as equivalent per-exercise via `grading: { ng_nang: true }` ([grading.ts#L16-L22](../../../packages/core/src/grading.ts#L16-L22)). Domain knowledge encoded as a grading flag — a nice interview example of product requirements leaking (correctly) into pure logic.

Drill: for each term, cover the right column and name the file from memory. Solid = 10+; Strong = you can also say which terms are **contracts** (Bundle, ProgressEvent) vs internal vocabulary (Session, Baseline).

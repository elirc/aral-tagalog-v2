# Performance Thinking

**Rule zero: measure first.** Nothing in this repo has a measured performance problem. This page teaches you where to *look*, how to measure, and what the likely first hotspots are — ranked, with anchors — so you practice the discipline of hypothesis-then-profile instead of vibes-then-memoize.

## Performance domains present here

| Domain | Where | Current state | How to measure |
| --- | --- | --- | --- |
| Server derive cost | [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) loads *all* user events per `/me`/`/sync` | O(events); fine ≤ ~10k events | `EXPLAIN ANALYZE` the select; time `reduceEvents` with synthetic 100k events in vitest |
| DB indexes | [(user_id, occurred_at) index](../../../packages/db/src/schema.ts#L58) | covers the only query pattern | `EXPLAIN` — confirm Index Scan not Seq Scan |
| Client re-renders | context value changes re-render all consumers ([progress.tsx#L143-L146](../../../apps/web/src/lib/progress.tsx#L143-L146)); 30s tick forces recompute ([L70-L72](../../../apps/web/src/lib/progress.tsx#L70-L72)) | trivial at this component count | React DevTools Profiler, "Highlight updates" |
| Bundle size | course JSON compiled *into* the web JS payload ([content.ts#L2](../../../apps/web/src/lib/content.ts#L2)) — 136 exercises ≈ tens of KB now; grows with every unit | acceptable; watch it | `next build` route table (First Load JS); it printed ~118 kB for `/` at build time — verified |
| Serial async | audio prefetch loop ([mobile audio.ts#L34-L47](../../../apps/mobile/src/lib/audio.ts#L34-L47)); outbox row-by-row ops ([storage.ts#L61-L66](../../../apps/mobile/src/lib/storage.ts#L61-L66)) | deliberate/cheap | timestamps around the loop |
| Memory | API caches nothing; content served via streams ([content routes#L24-L27](../../../apps/api/src/routes/content.ts#L24-L27)) | flat | `process.memoryUsage()` under load |

## The likely first real hotspot, reasoned

Per-request full-history reduce (row 1) grows linearly forever — a daily user generates ~5k events/year (estimate: ~15/day). At 3 years ≈ 15k events → single-digit-ms reduce + a few ms Postgres fetch: still fine. The *actual* first pain will be **payload growth of the events fetch** (jsonb rows over the wire), not CPU. Mitigation ladder, cheapest first: (1) select only `payload` (already done, [progress.ts#L8](../../../apps/api/src/progress.ts#L8)); (2) snapshot table keyed by last event id; (3) event compaction (fold ancient events into a checkpoint event — note this bends the append-only rule and needs design care).

Being able to *rank mitigations by cost and name the trigger metric* ("act when p95 /me > 50ms or events/user > 50k") is the whole senior game.

## How to find the classics here

- **N+1:** none server-side today (one query per request). The pattern to watch: any future loop calling `getUserProgress` per user (leaderboards!). Detection: pino logs one line per query if you enable drizzle logging — or count queries per request in tests.
- **Expensive renders:** open React DevTools Profiler, play a lesson; confirm the exercise card re-renders on keystroke/tap only. The seeded shuffles ([ChoiceView.tsx#L7-L18](../../../apps/web/src/components/exercises/ChoiceView.tsx#L7-L18) inside `useMemo`) exist precisely so options don't reshuffle per render — a *correctness*-flavored perf fix worth citing.
- **Oversized bundles:** the course-in-JS decision (row 4) trades bundle size for zero-latency content. The flip point: when content ≫ code, switch web to fetching the bundle like mobile does. Know the number: check `du -h packages/content/dist/course_en_tl.json` (~100–200KB now, inferred).
- **Unbounded queries:** `progress_events` select has no LIMIT ([progress.ts#L7-L11](../../../apps/api/src/progress.ts#L7-L11)) — intentional (need full history) but flag it in review whenever you see it elsewhere; here it's the documented scaling debt.

## Drill

Write the vitest micro-benchmark: generate 100k synthetic events (mix of types), time `reduceEvents` (`performance.now()` around it), report events/ms. Then answer: at your measured rate, how many *years* of daily play until reduce exceeds 16ms (one frame)? Show the arithmetic.

Self-grade — Basic: benchmark runs. Solid: you controlled for JIT warmup (run twice, report second). Strong: your answer distinguishes reduce CPU cost from DB fetch cost and says which wall arrives first, with the mitigation you'd pick.

Interview angle: "How would you find a performance problem?" → measure-first + the mitigation-ladder story. "When do you optimize?" → trigger metrics, not instincts. → [system design 10x prompt](../08-interview-prep/04-system-design-from-this-repo.md).

# File Reading Order

28 files. For each: why it matters / what to look for / what to ignore. Junior path = 1–14. Mid path adds 15–22. Senior path adds 23–28 and reads everything asking "what would I change?"

## Junior path (locate & explain)

| # | File | Look for | Ignore |
| --- | --- | --- | --- |
| 1 | [README.md](../../../README.md) | "Deliberate simplifications" section — design intent | deploy notes |
| 2 | [package.json](../../../package.json) + [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) | script names; workspace globs | turbo internals |
| 3 | [packages/core/src/types.ts](../../../packages/core/src/types.ts#L8-L115) | `CourseBundle` tree; the 5-member `Exercise` union | — |
| 4 | [packages/core/src/grading.ts](../../../packages/core/src/grading.ts#L7-L61) | normalization order; `accept` alternates; Tagalog flags | regex details |
| 5 | [packages/core/src/session.ts](../../../packages/core/src/session.ts#L25-L84) | queue of indices; wrong answers re-queued at the back | — |
| 6 | [packages/core/src/hearts.ts](../../../packages/core/src/hearts.ts#L13-L49) | time-based regen with no timers; `updatedAt` bookkeeping | — |
| 7 | [packages/core/src/streak.ts](../../../packages/core/src/streak.ts#L14-L47) | day-key strings via `Intl`; why not `Date.getDate()` | — |
| 8 | [packages/core/src/events.ts](../../../packages/core/src/events.ts#L13-L86) | event union; reducer; the `initial` baseline param | — |
| 9 | [packages/core/src/session.test.ts](../../../packages/core/src/session.test.ts) | how pure logic is tested without React | — |
| 10 | [apps/web/src/lib/content.ts](../../../apps/web/src/lib/content.ts#L2-L33) | build-time bundle import; unlock rule | — |
| 11 | [apps/web/src/lib/progress.tsx](../../../apps/web/src/lib/progress.tsx#L21-L161) | outbox/baseline/auth keys; the 3 `useEffect`s | render details |
| 12 | [apps/web/src/components/LessonPlayer.tsx](../../../apps/web/src/components/LessonPlayer.tsx#L33-L172) | phase state; `completionSent` ref; practice rules | CSS classes |
| 13 | [apps/web/src/app/page.tsx](../../../apps/web/src/app/page.tsx#L13-L40) | `nextFound` unlock walk | markup |
| 14 | [packages/content/course/en-tl/units/01-greetings.yaml](../../../packages/content/course/en-tl/units/01-greetings.yaml) | authoring format vs runtime format | Tagalog itself (unless curious) |

## Mid path (modify safely)

| # | File | Look for |
| --- | --- | --- |
| 15 | [packages/db/src/schema.ts](../../../packages/db/src/schema.ts#L14-L59) | composite PK `(userId, id)` on events — the idempotency key |
| 16 | [apps/api/src/app.ts](../../../apps/api/src/app.ts#L16-L28) | how routes/db are wired; `origin: true` CORS |
| 17 | [apps/api/src/auth.ts](../../../apps/api/src/auth.ts#L9-L50) | JWT vs hashed refresh token split; `requireAuth` preHandler |
| 18 | [apps/api/src/routes/auth.ts](../../../apps/api/src/routes/auth.ts#L14-L74) | rotation (delete-then-issue); email lowercasing |
| 19 | [apps/api/src/routes/sync.ts](../../../apps/api/src/routes/sync.ts#L8-L67) | zod event schema duplicated from core types; clamp; `onConflictDoNothing` |
| 20 | [apps/api/src/progress.ts](../../../apps/api/src/progress.ts#L6-L13) | server reuses the client's reducer — the payoff of shared core |
| 21 | [packages/content/src/compile.ts](../../../packages/content/src/compile.ts#L31-L127) | deterministic shuffle; auto word banks; audio manifest |
| 22 | [apps/api/src/routes/content.ts](../../../apps/api/src/routes/content.ts#L11-L38) | filename allowlist regexes; immutable cache headers |

## Senior path (critique & design)

| # | File | Ask |
| --- | --- | --- |
| 23 | [apps/mobile/src/lib/storage.ts](../../../apps/mobile/src/lib/storage.ts#L12-L70) | is sync-SQLite on the JS thread acceptable? at what scale not? |
| 24 | [apps/mobile/src/lib/progress.tsx](../../../apps/mobile/src/lib/progress.tsx#L42-L110) | compare to web's store — what's duplicated that could be shared? |
| 25 | [apps/mobile/src/lib/content.ts](../../../apps/mobile/src/lib/content.ts#L8-L33) | shipped-vs-downloaded bundle precedence; version race? |
| 26 | [apps/api/src/env.ts](../../../apps/api/src/env.ts#L8-L20) | secrets handling; the prod guard; what's missing (validation) |
| 27 | [packages/core/src/events.test.ts](../../../packages/core/src/events.test.ts) | which reducer properties are *not* tested? (concurrent same-timestamp events, DST) |
| 28 | [turbo.json](../../../turbo.json) + [docker-compose.yml](../../../docker-compose.yml) | build graph correctness; dev-env reproducibility |

Pause-and-predict while reading #19: the API re-declares event validation in zod even though core has TS types. Why can't it just use the TS types? (Types erase at runtime; the wire is untrusted input — validation must be a runtime **boundary** check. Interview staple.)

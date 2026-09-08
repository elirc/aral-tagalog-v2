# 30 midlevel feature stories and implementation plans for Aral

**Status: planning only.** These are requests for future features. Creating this document does not implement, test, migrate, or release any of them.

Prepared on 2026-09-08 against the files currently in this workspace. Read the source again before beginning a story: another contribution may have changed its integration points. This is a separate backlog from the [25 junior stories](25-junior-feature-stories-and-implementation-plans.md). The junior stories are not prerequisites and should not be treated as already implemented.

## How to use this document

Each story is a bounded project for a midlevel engineer working on an app with a few users. The extra depth comes from owning state transitions, contracts, concurrency, compatibility, and validation, rather than adding infrastructure. One story means one reviewable feature branch; larger stories can use the numbered steps as a sequence of commits on that branch. Estimates are focused engineering days after setup, including tests and review fixes, not delivery deadlines.

The implementation plans specify the intended first version. Do not silently expand a device-local feature into cloud synchronization, a read-only report into a CMS, or a retry improvement into a background job platform. Where a helper or endpoint is proposed, it does not exist yet unless the text explicitly says otherwise. Linked files exist; new paths are written as inline code. All commands below are instructions for the future implementer, not commands run while preparing this backlog.

### Story index

| ID | Requested feature | Main learning area | Effort |
| --- | --- | --- | --- |
| MID-01 | Search the whole course from one screen | Typed indexing, ranking, navigation | 2–3 days |
| MID-02 | Organize lessons into named collections | Local schema design, account isolation | 2–3 days |
| MID-03 | Build a short ordered study queue | Route state, current permissions, explicit transitions | 3–4 days |
| MID-04 | Choose the scope of a mistake-review session | Shared selection rules, immutable session input | 2–3 days |
| MID-05 | Explain why a lesson is locked | Derived domain decisions, shared presentation contracts | 2–3 days |
| MID-06 | Browse a searchable grammar-note library | Content projections, stable deep links | 2–3 days |
| MID-07 | Type translations instead of using word chips | Input adapters, grading parity, keyboard handling | 2–3 days |
| MID-08 | Compare a missed answer with the model answer | Bounded sequence comparison, honest feedback | 3–4 days |
| MID-09 | Inspect an attempt-by-attempt lesson recap | Ephemeral history, state-machine transitions | 2–3 days |
| MID-10 | Stop and replace web audio predictably | Async ownership, cancellation, resource cleanup | 3–4 days |
| MID-11 | Save private unit notes across web sessions | Drizzle migrations, optimistic concurrency | 4–6 days |
| MID-12 | Reopen recently visited lessons | Privacy-scoped persistence, lifecycle ordering | 2–3 days |
| MID-13 | Explore a monthly learning calendar | Calendar arithmetic, partial historical data | 2–3 days |
| MID-14 | Plan preferred study days for the week | Preference modeling, time zones, derived status | 2–3 days |
| MID-15 | Edit an account display name | Authenticated mutations, refresh and account races | 3–4 days |
| MID-16 | End all current refresh-token sessions | Transactions, auth lifecycle, truthful UI | 3–4 days |
| MID-17 | Understand why a saved change was rejected | Backward-compatible API evolution | 3–4 days |
| MID-18 | Download a sanitized troubleshooting report | Explicit serialization, support UX | 2–3 days |
| MID-19 | See and control the next sync retry | Retry scheduling, clocks, single-writer behavior | 3–5 days |
| MID-20 | Pull to refresh progress on mobile | Worker observability, native lifecycle | 2–3 days |
| MID-21 | Review and safely activate mobile content updates | Validated downloads, staged activation | 4–6 days |
| MID-22 | Download selected units for offline audio | Bounded file work, cancellation, cache correctness | 4–5 days |
| MID-23 | Get a web course-version update notice | Build-time content, reload boundaries | 2–3 days |
| MID-24 | Find contextual help inside the app | Structured content, routing, accessible search | 2–3 days |
| MID-25 | Prepare an exercise problem report | Reproduction context, privacy, local drafts | 2–3 days |
| MID-26 | Compare two curriculum bundles semantically | Stable identities, deterministic tooling | 3–4 days |
| MID-27 | Read authored explanations after answering | Schema-to-renderer contracts, optional fields | 3–4 days |
| MID-28 | Filter vocabulary by authored topic tags | Taxonomy validation, compiler compatibility | 3–4 days |
| MID-29 | Print a unit worksheet and separate answer key | Exhaustive projections, print layout | 3–4 days |
| MID-30 | Browse a server-confirmed account activity timeline | Keyset pagination, safe database projections | 4–5 days |

Start with MID-06 or MID-12 to learn the app, then MID-04 or MID-07 to trace a lesson, then MID-15 before touching auth-adjacent work. Leave MID-11, MID-16, MID-19 and MID-21 until you can explain the current persistence and synchronization behavior. This ordering is advice, not a dependency chain.

## Codebase map and shared implementation rules

| Concern | Existing entry points | Contract to understand |
| --- | --- | --- |
| Immutable course content | [types](../packages/core/src/types.ts), [web content](../apps/web/src/lib/content.ts), [mobile content](../apps/mobile/src/lib/content.ts) | Web imports content at build time. Mobile ships a bundle and can download a replacement. |
| Discovery and unlocks | [discovery](../packages/core/src/discovery.ts), [review](../packages/core/src/review.ts), [tiers](../packages/core/src/tiers.ts) | Search normalization is separate from grading; tier placement is additive. |
| Lessons and scoring | [session](../packages/core/src/session.ts), [grading](../packages/core/src/grading.ts), [web player](../apps/web/src/components/LessonPlayer.tsx), [native player](../apps/mobile/src/components/LessonPlayer.tsx) | Wrong answers requeue; matching completes through a separate callback; completion is emitted once. |
| Progress | [events](../packages/core/src/events.ts), [server validation](../apps/api/src/sync-validation.ts), [sync route](../apps/api/src/routes/sync.ts) | Server baseline plus local outbox; event UUIDs provide idempotency. `/sync` is the progress write path. |
| Web account state | [provider](../apps/web/src/lib/progress.tsx), [storage](../apps/web/src/lib/progress-storage.ts), [API client](../apps/web/src/lib/api.ts) | Generation guards and cross-tab coordination protect account switches and token refresh. |
| Native account state | [provider](../apps/mobile/src/lib/progress.tsx), [worker](../apps/mobile/src/lib/sync-worker.ts), [SQLite storage](../apps/mobile/src/lib/storage.ts) | One sync writer; baseline updates and acknowledged outbox removal are atomic. |
| Server and persistence | [app](../apps/api/src/app.ts), [auth](../apps/api/src/routes/auth.ts), [profile](../apps/api/src/routes/me.ts), [Drizzle schema](../packages/db/src/schema.ts) | Fastify plugins precede routes; PostgreSQL uses Drizzle, not Prisma. |
| Content authoring | [authoring schemas](../packages/content/src/schema.ts), [compiler](../packages/content/src/compile.ts), [semantic validation](../packages/content/src/validate.ts) | YAML becomes compiled JSON. The compiler currently executes its entry point on import. |
| Shipping | [Vercel guide](../docs/VERCEL.md), [release workflow](../.github/workflows/release-check.yml), [root scripts](../package.json) | Preview configuration and test databases are separate from production. |

### Invariants every story must preserve

- Do not assign to `UserProgress` to implement a feature. Existing progress events still flow through `addEvents` and `/sync`. Notes in MID-11 are separate user-authored records, like profile data, and do not become XP events.
- Do not change grading, XP caps, heart costs, placement, quest rewards, or historical event payloads incidentally. `lessonsCompleted` includes practice; `completedLessonIds` represents distinct learned lessons. `dayStats` retains a limited history; `xpByDay` is the long-term XP aggregate.
- Freeze a lesson's content and practice status at entry. Do not let an account switch, a changing review queue, or a downloaded bundle mutate a running exercise. Never emit a second completion because a panel opened or a component remounted.
- New local records use versioned, dedicated keys and runtime validation. Account A's private state must not appear under account B or guest state. A storage read failure must not trigger an effect that overwrites recoverable data with defaults.
- New authenticated requests go through provider/worker-owned coordination, not raw token reads in a component. Preserve generation checks after asynchronous boundaries and do not write stale tokens over a refreshed session.
- Pure domain helpers live in core and accept time/data explicitly. Browser APIs, filesystem operations, React and Expo stay outside core. Reuse installed dependencies; none of these stories requires a queue service, Redis, analytics vendor, or vector database.
- Do not rename published IDs or edit generated bundles directly. Additive content fields need compiler, type, validation and consumer coverage. Old bundles without optional fields must still load.
- New controls need loading, empty, failure, and success behavior, keyboard access, visible labels, light/dark styling and usable narrow layouts. Mobile checks include large text and screen-reader labels.
- Backend authorization is always enforced in the query/handler. Hiding a button is not authorization. Reports must use an explicit allowlist and must never serialize tokens, password hashes, complete storage, request headers, or database configuration.

### Setup and verification instructions

First inspect `git status --short`. Use a clean feature branch based on the reviewed app; do not reset or overwrite existing workspace work to follow this guide. Read the [README](../README.md) and [Vercel setup](../docs/VERCEL.md) for local account testing.

From the repository root in PowerShell, with Node 24 and the pinned pnpm available:

~~~powershell
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm content:build
corepack pnpm --filter @aral/ui build
node apps/web/scripts/prepare-content.mjs
$env:NEXT_PUBLIC_API_URL = '/api'
corepack pnpm web:dev
~~~

Use the URL printed by the development server. Guest content work needs no account. API/account work requires a migrated disposable PostgreSQL database and server environment. The existing database integration suite is enabled by `TEST_DATABASE_URL`; a green suite that skipped it does not verify transactions. Never point that variable at production. For a migration story, generate and inspect the migration with the existing Drizzle scripts, then run it only against a disposable database. Commit both the generated SQL and required Drizzle metadata with the eventual feature.

For mobile, run `corepack pnpm mobile:start` and follow the existing Expo configuration. A physical device needs an API address it can reach; its localhost is not your computer. Native file/audio behavior needs an emulator or device check in addition to mocked tests.

These verification groups are referenced below. Run each listed package's test and typecheck commands, from the root, once relevant changes are complete:

| Group | Commands |
| --- | --- |
| C: shared logic | `corepack pnpm --filter @aral/core test` and `corepack pnpm --filter @aral/core typecheck` |
| W: web | `corepack pnpm --filter @aral/web test` and `corepack pnpm --filter @aral/web typecheck` |
| M: mobile | `corepack pnpm --filter @aral/mobile test` and `corepack pnpm --filter @aral/mobile typecheck` |
| A: API | `corepack pnpm --filter @aral/api test` and `corepack pnpm --filter @aral/api typecheck` |
| D: schema | `corepack pnpm --filter @aral/db typecheck`; add the story's disposable-Postgres integration checks |
| T: content | `corepack pnpm --filter @aral/content test` and `corepack pnpm --filter @aral/content typecheck` |

Use tiny fixtures for domain tests and controlled deferred promises for races. The web app has no general component-test harness at this snapshot; use existing Vitest helpers plus explicit manual UI checks instead of adding a framework merely to check text. Before review, run `corepack pnpm release:check`; for shipped web changes also run `corepack pnpm --filter @aral/web build` after dependency builds. Use the existing release workflow for native exports and deployment packaging. Do not weaken checks to pass under local resource contention.

---

## MID-01 — Search the whole course from one screen

**User story:** As a learner, I want one search screen that finds units, lessons and vocabulary so I can locate a topic without knowing which part of the app contains it.

**Current gap and learning goal:** The course map and phrasebook already search their own content. They do not return a combined, typed result list. Learn to separate a reusable index from ranking, UI pagination and route construction.

**Size and scope:** 2–3 days, core and web. No external search service, fuzzy spelling correction, answer indexing, or junior-story dependency.

**Read first:** [discovery](../packages/core/src/discovery.ts), [course page](../apps/web/src/app/page.tsx), [phrasebook](../apps/web/src/app/words/page.tsx), [Header](../apps/web/src/components/Header.tsx). New: `packages/core/src/catalog-search.ts`, its test, and `apps/web/src/app/search/page.tsx`.

**Acceptance criteria**

- One labeled query returns grouped unit, lesson and vocabulary results; blank input explains what can be searched.
- Exact normalized titles rank before title prefixes, then other title matches, then descriptions/translations. Equal scores have a documented stable tie-break.
- Results include their type and parent unit/track where relevant; locked lessons are visibly locked and route guards still apply.
- Each group shows at most 20 results initially, with an explicit way to see the next page and a result count.
- Queries are bounded to 120 characters and text is rendered normally, without HTML injection or answer spoilers.

**Implementation plan**

1. Trace `matchesSearch`, `normalizeSearch` and `searchVocab`; write a three-entry example showing why search normalization must not use `normalizeAnswer`.
2. Define a discriminated result type with `kind`, stable ID, title, optional subtitle and parent IDs. Keep URLs and React elements out of core.
3. Build the index once per bundle identity/version from titles, descriptions and vocabulary meanings. Exclude exercise answers and arbitrary serialized object fields.
4. Implement the ranking tiers above using existing normalization, then tie-break by kind and stable ID. Return fresh arrays and do not reorder the input bundle.
5. Add the new page with query, kind filter and page state. Reset page on query/filter changes, memoize the index, and avoid rebuilding it on every keystroke.
6. Link lesson results through the existing route. Give unit results a stable unit-detail destination: if no unit page exists, add a small read-only unit result view in this feature; do not depend on another backlog story.
7. Let vocabulary results expand their meaning/audio inline on this page, using the existing audio helper. This avoids assuming the junior phrasebook deep-link story exists.
8. Add a discoverable header link and an explicit title mapping; keep navigation usable at 320px. Show useful zero-result copy and clear filters independently.
9. Verify ranking against fixtures, then search one known title, translation and missing term in the actual bundle. Record before/after interaction behavior without imposing a machine-specific timing assertion.

**Validation:** Groups C and W. Fixtures cover accents, case, punctuation, duplicate titles in different units, equal scores, blank query, query limit and stable pagination. Manually open a locked result, return to search, and test keyboard navigation and narrow width.

**Rollout / review checkpoint:** No migration or content rebuild is required for this feature itself. Removing the route and navigation entry rolls it back. Explain why building a normalized index is different from copying the course into a second mutable source of truth.

---

## MID-02 — Organize lessons into named collections

**User story:** As a learner, I want named collections such as “Before my trip” so I can keep related lessons together even when they belong to different units.

**Current gap and learning goal:** The course browser follows curriculum order; it has no user-defined lesson grouping. This is distinct from favoriting vocabulary in the junior backlog. Learn validated local schemas, referential integrity and account-scoped editing.

**Size and scope:** 2–3 days, web only. Up to 10 collections and 50 lesson IDs per collection, stored on this browser. No cloud sync, import/export, collaborative lists or drag-and-drop library.

**Read first:** [web provider](../apps/web/src/lib/progress.tsx), [progress storage patterns](../apps/web/src/lib/progress-storage.ts), [content types](../packages/core/src/types.ts), [course page](../apps/web/src/app/page.tsx). New: `apps/web/src/lib/lesson-collections.ts`, tests, and `apps/web/src/app/collections/page.tsx`.

**Acceptance criteria**

- A learner can create, rename and delete a collection, and add/remove existing lessons without duplicating an ID.
- Names trim outer whitespace, contain 1–60 characters, and are rendered as text. Limits produce a useful message.
- Reload preserves collections. Switching accounts immediately shows only the new scope; guest collections stay guest-local rather than being silently merged.
- A deleted content ID appears as “Lesson no longer available” with a remove action; it does not crash or silently erase the collection.
- Saving or opening a collection grants no progress and does not bypass lesson locks.

**Implementation plan**

1. Define `CollectionV1` with a generated collection ID, name and ordered lesson IDs, inside a versioned envelope. Use a dedicated key such as `aral.collections.v1.<scope>`.
2. Implement a runtime parser and pure create/rename/add/remove operations. Enforce caps and duplicate rules in the helpers, not only the UI.
3. Build a guarded storage adapter that returns an explicit read result. Preserve the original value on corruption and let the user deliberately reset only this key after seeing the failure.
4. Wait for provider readiness before choosing `guest` or a user-ID scope. Key the collection editor by scope and discard in-flight UI edits when the account changes.
5. Add the collection management screen and simple inline forms. Save on explicit actions; show a failure when persistence fails while keeping the current edit available to copy or retry.
6. Add an “Add to collection” action on lesson rows. Use a select plus submit button for existing collections; offer a link to collection creation rather than another full management modal.
7. Resolve stored lesson IDs against current content at render time. Keep unavailable placeholders and derive locked/completed labels from the current progress context.
8. Use up/down buttons if ordering is offered, preserving focus on the moved row. Collection deletion needs a specific inline confirmation that names the collection.
9. Document device-only behavior on the screen and include a way to remove an empty collection. Leave the outbox and auth keys untouched.

**Validation:** Group W. Test parser bounds, duplicate IDs, unknown versions, stale content IDs and a throwing storage adapter. Manually create guest/A/B collections, switch between them, rename at the limit and simulate a failed write.

**Rollout / review checkpoint:** The feature can be removed without changing progress. Retain its dedicated key when rolling back so a later re-enable can recover it. Explain the difference between a stale content reference and malformed persisted data.

---

## MID-03 — Build a short ordered study queue

**User story:** As a learner, I want to queue up to five lessons for this sitting and choose to continue to the next one after each completion.

**Current gap and learning goal:** Completion currently offers the curriculum's next lesson. There is no user-selected multi-lesson itinerary. Learn to coordinate route transitions with a local workflow while keeping the existing lesson state machine authoritative.

**Size and scope:** 3–4 days, web. One queue per account scope and tab in session storage; explicit add, reorder, remove and continue actions. No automatic lesson starts, persistent session resume or collection prerequisite.

**Read first:** [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [LessonPlayer](../apps/web/src/components/LessonPlayer.tsx), [review/unlocks](../packages/core/src/review.ts), [course page](../apps/web/src/app/page.tsx). New: `apps/web/src/lib/study-queue.ts`, tests, and a queue panel component.

**Acceptance criteria**

- Add only real, currently playable lessons; deduplicate IDs and cap the queue at five.
- Reorder using keyboard-accessible buttons. Starting the queue navigates to its first eligible item.
- Completing an item marks that queue item finished once and offers an explicit “Continue my queue” action. It emits no extra progress event.
- If the next item becomes unavailable, explain it and let the learner remove/skip it; do not silently launch a different lesson.
- Account changes clear the visible queue state immediately. Ordinary course navigation still works without a queue.

**Implementation plan**

1. Draw the queue states: editing, studying a specific item, awaiting explicit continuation, finished. Keep this state separate from `SessionState`.
2. Define a versioned queue containing stable lesson IDs and a queue ID. Store completion markers per item; do not infer them only from `completedLessonIds`, because practice can also be queued.
3. Add pure queue operations and validation. Inject the current eligible-ID set rather than importing browser content into the parser.
4. Add a guarded session-storage adapter scoped by user/guest. On restoration revalidate content IDs, and retain a visible unavailable item instead of crashing.
5. Add the course-page queue controls and a panel with current order. Use the existing unlock helper on add and again immediately before starting.
6. Pass an optional completion callback from the route to the player. Invoke it through the existing completion-once boundary and key its side effect by queue ID plus item ID.
7. After completion, render the next queue action beside the existing course action. Starting the next item must be a click, never an effect watching progress.
8. Treat Quit as leaving the current item unfinished. Do not reset its lesson progress events or attempt to restore the abandoned `SessionState` on return.
9. Guard restored queue state and completion callbacks against an account change. Test navigation to a lesson that is not in the queue without consuming an item.
10. Finish with empty, full, finished, stale-item and storage-failure copy; document that a new browser tab has its own session queue.

**Validation:** Groups C and W if core changes, otherwise W. Test duplicate callback delivery, reordering, cap, no eligible next item and account scope. Manually complete a queued practice lesson, quit another, reload the queue page and ensure XP changes only through the ordinary player.

**Rollout / review checkpoint:** No new progress event type is allowed. Rollback removes the queue UI and optional callback. Explain why a completed lesson ID is insufficient evidence that the current queued practice session just finished.

---

## MID-04 — Choose the scope of a mistake-review session

**User story:** As a learner, I want to review mistakes from a selected track or exercise format in a short session so I can focus on the skill I want to practice now.

**Current gap and learning goal:** `buildReviewLesson` already creates an oldest-first synthetic lesson, capped at 10 exercises. It has no track/type selection UI. Learn to extend selection without changing scoring or allowing live progress to reshuffle a running session.

**Size and scope:** 2–3 days, core and web first. Allow all/one track, all/one exercise type, and 5 or 10 exercises. Mobile can retain its existing review entry point. No spaced-repetition scheduler or new synthetic completion ID.

**Read first:** [review helper and tests](../packages/core/src/review.ts), [session outcomes](../packages/core/src/session.ts), [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [server validation](../apps/api/src/sync-validation.ts). New: a review-selection helper/test and `apps/web/src/app/review/page.tsx`.

**Acceptance criteria**

- The chooser shows how many current weak exercises match each selected scope and a clear zero-result state.
- Exercises keep the existing weak-queue order, omit stale IDs, and appear only once.
- Start captures the chosen set. Completing, syncing or changing weak IDs later cannot replace the current session.
- Review still uses `REVIEW_LESSON_ID`, practice XP, no heart losses, and the ordinary missed/mastered outcomes.
- Invalid or stale URL options fall back to documented defaults without throwing.

**Implementation plan**

1. Trace the existing review route's ref snapshot and practice flag. Write down why a recomputation after completion currently needs to be prevented.
2. Define a small `ReviewOptions` type and validate URL values against the bundle's track IDs, the exercise union and the allowed sizes.
3. Build an exercise-ID lookup with parent unit/track metadata. Deduplicate weak IDs while walking them in their original order.
4. Implement a pure selection helper that filters before slicing. Keep the existing `buildReviewLesson` signature usable; its default behavior must remain unchanged for mobile.
5. Add the chooser with labels, result count and Start action. Do not display correct answers or add/remove weak IDs merely by changing filters.
6. Pass validated options through query parameters to the existing review lesson route, then capture the selected synthetic lesson once when progress is ready.
7. Include the normalized option signature in the route instance key so deliberately starting a different scope gets a fresh snapshot. Do not key on changing progress arrays.
8. Add a route back to the chooser from the empty-review screen and a small scope label in the review heading.
9. Inspect the completion payload and server sanitizer with a fixture: maintain `practice: true`, current original exercise IDs and existing reward caps.

**Validation:** Groups C and W, plus A only if server code changes unexpectedly. Test stale/duplicate weak IDs, filtering before limit, all seven types, no tiers and default compatibility. Manually sync during review and verify the current exercise and completion screen remain stable.

**Rollout / review checkpoint:** This is a selection feature, not a new reward mechanism. Rollback returns entry links to `/lesson/review`. Explain why filtering already-selected ten exercises can incorrectly report an empty scope.

---

## MID-05 — Explain why a lesson is locked

**User story:** As a learner, I want a locked lesson to tell me the next concrete step needed to reach it, instead of leaving me to inspect the whole course.

**Current gap and learning goal:** Boolean unlock helpers and tier-status reasons already exist. The missing feature is an actionable lesson-level explanation that agrees with those helpers. Learn to expose domain decisions without creating a second unlock algorithm in each UI.

**Size and scope:** 2–3 days, core and both apps. No change to placement or course order. No unlock bypass, progress repair or inferred prerequisites beyond existing rules.

**Read first:** [review/unlocks](../packages/core/src/review.ts), [tiers](../packages/core/src/tiers.ts), [web lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [mobile course](../apps/mobile/app/index.tsx). New: `packages/core/src/lesson-access.ts` and tests.

**Acceptance criteria**

- A blocked lesson explains either the locked track or the first missing earlier lesson within the applicable sequence.
- The explanation includes a valid next action: an available prerequisite lesson, the course map, or existing placement UI as appropriate.
- Completed, placed-into and previously earned tracks retain current access behavior, including after course expansion.
- Unknown IDs return a not-found result; flat bundles still follow linear unlock rules.
- Both clients use the same decision result, with their own platform navigation and text rendering.

**Implementation plan**

1. Enumerate existing behavior from `isLessonUnlocked`, `isTierUnlocked` and their tests. Include historical completion in a later track and empty preceding tiers.
2. Define a decision union such as allowed, unknown lesson, blocked track, and blocked earlier lesson. Return IDs and reason codes, not English UI strings.
3. Implement the helper by reusing existing tier/lesson helpers first. If extracting a common internal decision function, keep the current boolean exports as wrappers and preserve their tests.
4. For a locked track, identify the prerequisite track under current rules; do not claim that finishing every earlier track is required when placement can open the destination.
5. For an open track, locate the first unfinished predecessor within that track. Handle untiered content using the existing flat sequence.
6. Add a small explanatory disclosure on locked course rows. Keep rows non-launchable; the suggested prerequisite is a separate labeled link/button.
7. Use the same result on direct lesson routes in web and mobile. Recheck current access at route entry rather than trusting a card's cached label.
8. Resolve missing suggested IDs defensively and fall back to the course map. Add title/parent context so repeated lesson names are understandable.
9. Add parity tests between the new decision's allowed state and the existing boolean helper across a fixture matrix; manually compare both apps on the same progress fixture.

**Validation:** Groups C, W and M. Cases: first lesson, gap in the same tier, locked later tier, placed tier, historical tier access, all-complete course, unknown lesson and flat bundle. Verify keyboard/screen-reader announcements without repeatedly announcing every locked row.

**Rollout / review checkpoint:** No events or data migrations. Rollback removes explanatory UI while retaining original guards. Explain why a reason helper that disagrees with the boolean guard is a domain bug, even when its wording sounds reasonable.

---
## MID-06 — Browse a searchable grammar-note library

**User story:** As a learner, I want to find grammar and culture notes in one library so I can revisit an explanation without opening many unit cards.

**Current gap and learning goal:** Units already carry `tip`, description and track metadata, but notes are embedded in course cards. Learn to build a read-only projection with stable identities, deep links and useful filtering without duplicating authored content.

**Size and scope:** 2–3 days, core and web. Search existing unit tips only. No new grammar claims, Markdown renderer, vocabulary-to-lesson inference, or prerequisite backlog work.

**Read first:** [Unit type](../packages/core/src/types.ts), [discovery](../packages/core/src/discovery.ts), [course page](../apps/web/src/app/page.tsx), [web content](../apps/web/src/lib/content.ts). New: `packages/core/src/grammar-library.ts`, tests, `apps/web/src/app/grammar/page.tsx`, and `apps/web/src/app/grammar/[unitId]/page.tsx`.

**Acceptance criteria**

- The library lists nonblank unit tips in course order, with original unit title and track.
- Search covers title and tip text; a track filter combines with it and resets pagination.
- Each note has a stable URL based on unit ID, works on direct reload, and has a useful not-found state.
- A note page offers real lesson links labeled with current access state; reading a note never records completion.
- Blank tips, repeated titles, an untiered course and no matching notes all have defined behavior.

**Implementation plan**

1. Inspect a few current units and record the difference between `description` and `tip`. Use `tip` as the library body; do not relabel every description as a grammar explanation.
2. Add a pure projection returning unit ID, title, optional track ID and trimmed tip, preserving original ordering and input immutability.
3. Reuse search normalization and define a filter helper that operates on the projection. Slice only after applying query and track filters; use 20 notes per page.
4. Build the library page with visible count, reset filters, Previous/Next controls and an explicit heading/title mapping in navigation.
5. Implement the note detail route using the decoded route parameter only as an ID lookup. Render text with preserved paragraphs, never as raw HTML.
6. Add lesson links below the note using existing unlock checks; explain that the note is readable even if its practice lessons are locked.
7. Add “Open in grammar library” to unit cards that have a nonblank tip. Use unit IDs for URLs and React keys, never titles or list indices.
8. If the user visits an unknown unit or a unit with no tip, show distinct messages and a link back to the library. Do not manufacture a replacement explanation.
9. Check title ownership between Header and the detail route so the note title persists after mount; document the projection's source fields beside its helper.

**Validation:** Groups C and W. Test whitespace-only tips, duplicate titles, flat content, filtering before paging and immutable input. Manually open a deep link in a new tab, try an unknown ID, and use the whole flow at 320px with a keyboard.

**Rollout / review checkpoint:** No content migration. Rollback removes library routes and links while unit tips remain intact. Explain how preserving IDs avoids breaking saved URLs when an editor changes a title.

---

## MID-07 — Type translations instead of using word chips

**User story:** As a learner, I want to type a translation when I want a harder recall exercise, while still being able to switch back to the word bank before checking my answer.

**Current gap and learning goal:** The grader already accepts strings or token arrays, but translation/listening UI uses chips. Learn to add a second input adapter while preserving the shared grader, feedback phases and input ownership.

**Size and scope:** 2–3 days, web. Apply to `translate_taps` and `listen` only; leave arrange, choice, dialogue and matching unchanged. No new exercise type, XP bonus, auto-correction or automatic answer reveal.

**Read first:** [grading](../packages/core/src/grading.ts), [LessonPlayer](../apps/web/src/components/LessonPlayer.tsx), [TapsView](../apps/web/src/components/exercises/TapsView.tsx), [FillBlankView](../apps/web/src/components/exercises/FillBlankView.tsx). New: a typed translation view and, if necessary, a small pure input-mode helper/test.

**Acceptance criteria**

- Eligible exercises offer labeled “Word bank” and “Type answer” controls during answering.
- Switching modes clears the draft with an explicit hint; it never uses the canonical answer to populate a field.
- Typed text uses the same accepted alternatives and grading flags as chip submissions.
- Check is disabled for an empty/whitespace draft. Enter submits once, respects composition input, and cannot skip feedback.
- Feedback locks the selected mode and input. Retrying the exercise resets the answer and keeps a documented session-level mode preference.

**Implementation plan**

1. Trace how `TapsView` calls `onAnswerChange` and how the player handles Check and Enter. Write down which component owns Enter for a focused text input.
2. Define mode state in the player for this session, defaulting to word bank. Do not persist it in progress or assume the junior preference stories exist.
3. Build a controlled typed-answer component accepting value/change, disabled and submit callbacks. Use a visible label, language-appropriate attributes, and disable spellcheck/auto-capitalization where they would alter the exercise.
4. Adapt nonblank input to a string `UserAnswer`; send null for whitespace-only input. Do not normalize away the learner's display text before grading.
5. On mode changes, clear parent answer state and remount/reset the prior child draft. Explain that changing input mode clears the unfinished answer.
6. Route eligible exercise rendering to either the existing chip component or the new text component; leave every other exercise branch untouched.
7. Coordinate Enter with the existing global handler so only one path calls Check. Ignore composition events and keep Continue focus behavior after feedback.
8. Reset drafts on exercise ID and attempt changes, including a requeued miss. Keep audio controls available for listening without exposing its answer as placeholder text.
9. Review completion and heart-loss payloads against the old flow: typing changes input only, not grading, rewards or events.

**Validation:** Groups C and W. Reuse grading fixtures for alternate answers, accents, `ngNang` and hyphens. Manually switch modes after a partial chip answer, enter a wrong answer, retry, use composition input and press Enter rapidly. Verify one heart-loss action per submitted miss.

**Rollout / review checkpoint:** Default mode preserves today's experience. Rollback removes the mode switch and new view. Explain why converting all array answers to strings would break dialogue even though it works for translation.

---

## MID-08 — Compare a missed answer with the model answer

**User story:** As a learner, I want a readable comparison after a wrong sentence answer so I can see which words differ before trying again.

**Current gap and learning goal:** Feedback already shows a correct answer. It does not retain the submitted wording for a structured comparison. Learn bounded sequence alignment and distinguish display assistance from the authority of the grader.

**Size and scope:** 3–4 days, core and web. Sentence-style translation, listening, arrange and text fill-blank only. Exclude dialogue arrays and matching. No grammar diagnosis, generated explanations, or claim that the model answer is the only valid wording.

**Read first:** [grading](../packages/core/src/grading.ts), [session](../packages/core/src/session.ts), [player feedback](../apps/web/src/components/LessonPlayer.tsx). New: `packages/core/src/answer-comparison.ts`, tests and a feedback comparison component.

**Acceptance criteria**

- Comparison appears only after a submitted incorrect answer, preserving the learner's exact display text.
- The model answer is labeled as one model answer; accepted alternatives still grade correctly and do not get misleading error highlighting.
- Missing/extra/different word groups have text labels as well as color, with a plain-text fallback.
- Very long input uses a bounded fallback rather than unbounded dynamic-programming work.
- Opening the comparison cannot grade again, mutate a session or emit an event.

**Implementation plan**

1. Capture the actual submitted answer before the player clears it. Join chip arrays only for eligible sentence exercise types; never flatten dialogue in shared code.
2. Define comparison output as two ordered token lists with statuses, plus a fallback reason when limits are exceeded. Keep React markup out of core.
3. Implement longest-common-subsequence alignment on whitespace tokens with a fixed tie-break. Cap each side at 80 tokens and total input at 2,000 characters before allocating the matrix.
4. Compare token keys with case/diacritic/punctuation handling consistent with the exercise flags where practical, while retaining original tokens for display. If normalization cannot be mapped faithfully, show whole-answer text rather than inventing offsets.
5. Keep `grade` authoritative: generate this view only when its result was incorrect. Do not use comparison distance to accept an answer or award partial credit.
6. Extend the feedback phase snapshot with the submitted text and exercise identity. A changing current exercise must not cause the panel to compare against a different answer.
7. Render “Your answer” and “Model answer” with labeled differences; include a brief statement that other accepted answers may exist.
8. Add a disclosure so long feedback does not overwhelm the Continue action. Preserve keyboard focus on Continue and never announce every token individually as an alert.
9. Reset comparison state on advance/retry and verify it cannot retain another account's text after route remount.

**Validation:** Groups C and W. Fixtures cover repeated words, insertion, deletion, word order, identical normalized strings, accepted alternatives, empty tokens, 80/81-token boundaries and deterministic ties. Manually check word-chip and typed-input flows; MID-07 is optional, since string fill-blank answers already exist.

**Rollout / review checkpoint:** No content or event changes. Remove the comparison component to roll back. Explain why edit distance cannot safely stand in for linguistic correctness.

---

## MID-09 — Inspect an attempt-by-attempt lesson recap

**User story:** As a learner, I want to inspect my attempts at the end of a lesson so I can understand which exercises took several tries.

**Current gap and learning goal:** Session state aggregates mistakes and missed IDs but does not retain an ordered attempt history for the completion screen. This is more than the junior first-try percentage: it exposes the sequence and retry history. Learn to capture facts at transition boundaries without making them durable progress.

**Size and scope:** 2–3 days, web. In-memory recap for the current mounted lesson only, capped at 100 entries. No server history, persistent answer storage or new scoring.

**Read first:** [SessionState](../packages/core/src/session.ts), [web player](../apps/web/src/components/LessonPlayer.tsx), [MatchView](../apps/web/src/components/exercises/MatchView.tsx), [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx). New: `apps/web/src/lib/attempt-recap.ts`, tests and a recap component.

**Acceptance criteria**

- Completion can show exercise prompt/type, attempt number and correct/incorrect result in submitted order.
- Retried exercises appear as separate attempts. Matching contributes one completed-grid entry with its mistake count, not invented pair-level history.
- The recap never exposes answers for exercises that were not attempted.
- A visible truncation notice appears after the 100-entry cap; counts used for scoring still come from the session state.
- Reload, Quit or account change discards this recap; the screen makes no promise of saved history.

**Implementation plan**

1. Identify the normal Check transition and the separate `completeMatch` path. Add a note explaining why an effect on `session.mistakes` cannot reconstruct every attempt.
2. Define a recap entry with sequence, exercise ID/type, submitted result and optional matching-mistake count. Store only the text needed for this screen, and clone answer arrays if retained.
3. Implement an append helper with a cap and a separate `truncated` flag. Derive per-exercise attempt numbers from captured entries rather than global render counts.
4. Capture an entry at each accepted submission boundary using the outcome already returned by `submitAnswer`. Ignore submissions while feedback/another transition is active.
5. Use a synchronous transition guard where needed to prevent rapid double clicks from recording the same pre-transition state twice. Keep it aligned with the existing Check/Continue lifecycle.
6. For matching, record a summary only when the grid completion callback runs; do not refactor pair-level grading just to add detail.
7. Render the recap behind a completion-screen disclosure. Resolve exercise labels from the frozen lesson snapshot and offer type-based labels when there is no single prompt field.
8. Keep recap state inside the account-keyed lesson instance. Do not write it to `ProgressStorage`, the event stream, analytics or a console.
9. Test completing with repeated misses and confirm the recap agrees with session totals while XP and completion remain unchanged.

**Validation:** Group W and C if a shared helper is added. Test answer-array cloning, repeat attempts, one matching summary, cap behavior and duplicate transition protection. Manually expand/collapse the recap, navigate away and verify another lesson begins empty.

**Rollout / review checkpoint:** Purely additive ephemeral UI. Rollback drops the recap state and panel. Explain why full learner answers should not be added to completion events merely to make this screen convenient.

---

## MID-10 — Stop and replace web audio predictably

**User story:** As a learner, I want a Stop control and predictable behavior when I play another phrase so overlapping speech does not make listening confusing.

**Current gap and learning goal:** Audio helpers already try recordings and TTS and report unavailable playback, but callers do not own a cancellable playback session. This is different from the junior autoplay toggle and TTS-speed selector. Learn asynchronous ownership and cleanup across delayed media callbacks.

**Size and scope:** 3–4 days, web only. One active playback at a time, with play/stop/status for explicit audio controls. No recording, waveform editor, speed feature or audio-library migration.

**Read first:** [web audio](../apps/web/src/lib/audio.ts), [phrasebook](../apps/web/src/app/words/page.tsx), [player](../apps/web/src/components/LessonPlayer.tsx), [API audio URL](../apps/web/src/lib/api.ts). New: playback-controller tests and a small reusable audio-control component.

**Acceptance criteria**

- Starting a new clip stops the old recording or TTS utterance; Stop affects only the currently owned playback.
- The active control displays loading/playing/stopped/unavailable states truthfully for both recordings and generated speech.
- A stopped or replaced request cannot later start TTS through an old fallback callback.
- Unmounting a control cleans up its playback without stopping newer playback started elsewhere.
- Existing `playAudio` call sites keep their documented boolean behavior until migrated; intentional cancellation is not shown as “Audio unavailable.”

**Implementation plan**

1. Trace existing HTMLAudio and speech-synthesis lifecycle behavior. List current promise resolution points before changing them, including playback rejection and speech errors.
2. Introduce an internal controller with a monotonically increasing request ID, owned media/utterance references, and a typed terminal result such as ended, cancelled or unavailable.
3. Implement stop/replacement to increment ownership, remove listeners, pause/reset owned media and cancel owned speech. Resolve any waiting promise exactly once.
4. Check ownership after every asynchronous boundary, especially recording failure before TTS fallback. An old request must return cancelled instead of speaking.
5. Expose a small subscription or callback interface for loading/playing/terminal status. Keep browser globals behind an injectable adapter for tests and guard unsupported APIs.
6. Keep a compatibility `playAudio` wrapper, mapping cancellation to a non-error result while preserving genuine unavailability feedback. Preserve the current wrapper timing for existing callers: recordings resolve after playback starts, while TTS resolves when speech ends. New controls must use explicit status notifications rather than interpreting that compatibility promise as a universal finished signal.
7. Add explicit Play/Stop controls to the phrasebook and relevant lesson audio actions. Use request handles so cleanup from row A cannot stop newer row B.
8. On route unmount, stop only the handle owned by that component. Do not call global cancellation blindly from every row cleanup.
9. Verify rapid A/B/A playback, a failed recording followed by TTS, stopping while loading, missing speech support and a late callback after unmount.

**Validation:** Group W. Use fake media/speech adapters and deferred promises to test every race, listener removal and single settlement. Manually check a browser with recorded audio and a missing-recording fallback, including keyboard Stop controls.

**Rollout / review checkpoint:** Preserve a simple wrapper API so the feature can be rolled back at call sites. If later combined with junior audio stories, rebase their optional preferences onto this ownership contract. Explain why cancelling the visible UI alone does not cancel a pending fallback operation.

---
## MID-11 — Save private unit notes across web sessions

**User story:** As a signed-in learner, I want to save my own note for a unit and see it on another browser, with a warning if another tab edited it first.

**Current gap and learning goal:** Units have authored tips, but there is no private learner-note storage. Learn a small relational feature end to end: ownership, an additive migration, optimistic concurrency and a form that preserves unsaved text.

**Size and scope:** 4–6 days, database, API and web. One plain-text note per user/course/unit, at most 2,000 characters. Explicit online Save; no offline note outbox, rich text, sharing or note-search service. This is not a progress mutation.

**Read first:** [Drizzle schema](../packages/db/src/schema.ts), [database scripts](../packages/db/package.json), [profile route](../apps/api/src/routes/me.ts), [API app](../apps/api/src/app.ts), [web provider](../apps/web/src/lib/progress.tsx). New: note table/migration, `apps/api/src/routes/notes.ts`, integration tests, and a web unit-note editor.

**Acceptance criteria**

- A signed-in user can read/save/clear their note; guest UI explains that an account is required.
- All database reads/writes are scoped by authenticated user ID. Another user's IDs cannot expose or modify a note.
- Saving uses an expected revision; a stale edit returns 409 and preserves the local draft while offering the latest server text.
- A failed or timed-out save never displays “Saved.” A repeated save with an old revision cannot silently overwrite newer text.
- Clearing a note removes visible text while preserving revision history needed to reject stale edits. Progress, XP and lesson access do not change.

**Implementation plan**

1. Define `unit_notes` with composite primary key `(user_id, course_id, unit_id)`, plain body, integer revision and server `updated_at`; reference users with cascade delete. Keep content IDs as text, since content is not stored in PostgreSQL.
2. Generate an additive Drizzle migration using the existing script. Inspect SQL and metadata, then apply to an empty disposable database and one with existing test users/events. Do not edit prior migrations.
3. Define authenticated GET/PUT routes for one course/unit. GET returns `{ body, revision, updatedAt }`, with revision 0 for no record. PUT accepts a strict `{ body, expectedRevision }` schema with safe length/integer bounds.
4. Scope every query by `req.userId` and validated course/unit identifiers. For creation, validate the unit against current compiled content through a testable lookup; allow reading existing notes for retired IDs rather than deleting them during content updates.
5. For revision 0, insert revision 1 with conflict protection. Otherwise update only where revision matches, incrementing it atomically. No matching write means 409 with the current sanitized note, not an unconditional retry.
6. Treat an empty body as a saved cleared note, keeping the row/revision. This avoids resurrecting old text through a stale revision-0 create after deletion.
7. Register routes in the existing plugin child context and add typed web API calls. Reuse or narrowly extract provider-owned authenticated request coordination; do not expose tokens to the note component or depend on MID-15 being implemented.
8. Add the editor beside a unit's authored tip with separate labels for course content and personal text. Keep draft, server value, revision and pending/error state separate; Save is explicit.
9. On 409, show both current server text and retained draft. Offer “Load latest” or let the learner review and deliberately save their text against the new revision; never automatically overwrite.
10. Key the editor by account/course/unit and fence delayed responses by account generation. If content disappears, preserve the existing note and provide a readable retired-unit label rather than discarding it.

**Validation:** Groups D, A and W, with actual `TEST_DATABASE_URL` integration tests. Cover two users, concurrent creates, concurrent edits, clearing then stale save, body/revision bounds, missing content lookup and a failed transaction. Manually edit the same unit in two tabs and verify draft preservation on 409.

**Rollout / review checkpoint:** Deploy the additive migration before the API/UI. Rollback the UI/routes while leaving the table and notes intact; no destructive down migration is needed. Explain why a last-writer-wins profile update is acceptable for some fields but not the requested note editor behavior.

---

## MID-12 — Reopen recently visited lessons

**User story:** As a learner, I want a recent-lessons list so I can reopen a lesson I inspected or practiced without searching for its unit again.

**Current gap and learning goal:** Progress records completion, not visits. A visit history cannot be reconstructed from completed IDs. Learn lifecycle-safe local history that stays separate from authoritative learning data.

**Size and scope:** 2–3 days, web. The last 20 distinct real lesson IDs per account scope on this browser. Exclude synthetic review sessions, locked-route attempts and invalid IDs. No analytics upload or cross-device history.

**Read first:** [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [web provider](../apps/web/src/lib/progress.tsx), [storage patterns](../apps/web/src/lib/progress-storage.ts), [content lookup](../apps/web/src/lib/content.ts). New: `apps/web/src/lib/recent-lessons.ts`, tests and a recent-lessons panel.

**Acceptance criteria**

- Entering a valid playable lesson moves it to the front of the history, without duplicates.
- The list distinguishes “visited” from completed/practice status and derives access from current progress.
- Reload persists history; account switching and guest mode never show another scope's entries.
- Unknown content IDs are omitted from the visible list with an optional removed-count message, without rewriting unrelated storage.
- A “Clear recent lessons” action removes only this scope's history and does not affect progress or other study features.

**Implementation plan**

1. Locate the route boundary after readiness, lookup and unlock validation. That is where a visit becomes eligible; rendering a course card or prefetching a link is not a visit.
2. Define a versioned array of `{ lessonId, visitedAt }`, with a cap of 20 and an injected clock for pure operations. Reject malformed IDs/timestamps and deduplicate on load.
3. Use a dedicated scoped key and a guarded storage adapter. Return a usable in-memory view on write failure, paired with a truthful “not saved on this device” notice.
4. Record through a small child component/effect mounted only for validated playable lessons, avoiding conditional hooks in the route. Deduplicate effect replays so development Strict Mode does not create duplicate rows.
5. Freeze the account scope for each write and check it is still active. Reset panel state immediately on a scope change rather than waiting for a read effect to reveal the mismatch.
6. Add a course-page panel showing the first five entries with an expandable full list. Resolve current titles, unit names and completion state at render time instead of storing copied metadata.
7. Revalidate eligibility when opening an entry. If a content update changed access, use the existing locked route rather than restoring a saved allow flag.
8. Add a specific clear action with inline confirmation and preserve other `aral.*` keys. Distinguish clearing history from deleting learned lessons in the copy.
9. Verify ordinary lesson entry, practice, invalid URL, locked URL and review route behavior, then inspect persisted JSON for absence of tokens and answer text.

**Validation:** Group W. Test move-to-front, cap, equal timestamps, corrupted JSON, future/invalid timestamps and unavailable storage. Manually visit as guest/A/B, reload and clear A's history while B's remains intact.

**Rollout / review checkpoint:** Device-local convenience only. Removing the panel does not affect lesson progress. Explain why marking a lesson “visited” inside its completion effect would produce an incomplete and misleading history.

---

## MID-13 — Explore a monthly learning calendar

**User story:** As a learner, I want to browse my learning days by month and inspect a day's available details so I can see longer-term patterns.

**Current gap and learning goal:** Stats already show recent activity and aggregate XP. The junior backlog adds a seven-day summary; this story adds month navigation, day selection and honest treatment of older details. Learn calendar modeling without pretending trimmed data is complete.

**Size and scope:** 2–3 days, core and web. Monday-first month grid, XP per day and available day-stat breakdown. No historical daily-goal success claims, since past goal values are not present in the aggregate baseline.

**Read first:** [stats page](../apps/web/src/app/stats/page.tsx), [events/day history](../packages/core/src/events.ts), [streak day keys](../packages/core/src/streak.ts), [quests](../packages/core/src/quests.ts), [clock hook](../apps/web/src/lib/use-clock.ts). New: `packages/core/src/activity-calendar.ts`, tests and a calendar component.

**Acceptance criteria**

- Previous/Next month navigation includes zero-XP days and uses valid calendar dates across leap years and year boundaries.
- Selecting a day shows XP including quest rewards, and lesson/practice details only when `dayStats` actually contains them.
- Older missing details say “Detailed counts are unavailable,” not zero lessons.
- Future dates do not display earned progress or offer misleading comparisons. The current day uses the same device timezone convention as existing stats.
- All dates have meaningful accessible labels and an equivalent readable list/table on narrow screens.

**Implementation plan**

1. Trace how `xpByDay` and `dayStats` are produced and trimmed. Write a fixture where an old date has XP but no day-stat entry.
2. Define an explicit `year`, `month` and `todayKey` input. Use UTC arithmetic for calendar-key construction, with local-day calculation performed at the boundary through existing helpers.
3. Build a pure month model containing dates, weekday offsets, XP and optional details. Ignore malformed keys and nonfinite/negative XP defensively.
4. Mark detail availability independently from numeric counters. Do not reconstruct lesson count by dividing XP by an assumed lesson reward.
5. Add month navigation bounded from the earliest valid activity month through the current month. For an empty history, show only the current month with an explanation.
6. Render date buttons in a semantic table or labeled grid. Prefer normal button tab order with clear labels unless fully implementing the keyboard model required by an ARIA grid.
7. Keep selected date in state, clamping or clearing it deliberately on month change. Render a textual detail panel with optional counts and a total that labels quest-inclusive XP.
8. Update today's marker through the existing clock hook, without rebuilding unrelated application state or changing stored historical day keys.
9. Check that long localized date labels, dark mode and 320px width remain readable. Do not encode activity solely by heat-map color.

**Validation:** Groups C and W. Fixtures cover February in leap/non-leap years, December/January, month starting Sunday, missing day details, malformed keys and future entries. Manually navigate with keyboard and inspect an old XP-only day.

**Rollout / review checkpoint:** Read-only and migration-free. Explain why applying today's goal to every historical date would invent past goal completion.

---

## MID-14 — Plan preferred study days for the week

**User story:** As a learner, I want to choose the weekdays I intend to study and see this week's plan so I can make a realistic routine without changing my streak rules.

**Current gap and learning goal:** Daily XP goals exist, but the app does not track preferred study days. Learn to model intentions as preferences and derive their presentation from actual activity without rewriting gamification.

**Size and scope:** 2–3 days, core and web. A device-local, account-scoped weekday selection and optional session target of 5/10/15 minutes. No notifications, calendar integration, timers, server writes or streak forgiveness.

**Read first:** [stats](../apps/web/src/app/stats/page.tsx), [streak helpers](../packages/core/src/streak.ts), [events](../packages/core/src/events.ts), [web provider](../apps/web/src/lib/progress.tsx). New: `packages/core/src/weekly-plan.ts`, tests and a web preference adapter/panel.

**Acceptance criteria**

- The learner can select zero through seven weekdays and one suggested duration, then explicitly save this browser's plan.
- A Monday-to-Sunday view distinguishes planned days, days with recorded XP and upcoming days.
- Rest days are labeled as preferences, not protected streak days; no rewards or progress events are emitted.
- Changing the plan affects the current display immediately but does not claim a historical schedule was followed.
- Reload/account switching/storage failures behave consistently with the scope and save notice.

**Implementation plan**

1. Define weekdays with explicit numeric meaning, such as ISO Monday 1 through Sunday 7. Never rely on a locale's display order or `getDay()` values without conversion.
2. Define a versioned preference with unique weekday values and an allowed suggested-minute value. Keep actual elapsed study time out of the record because the app does not measure it here.
3. Add a pure week builder receiving `todayKey`, preference and XP history. Use existing local-day boundary helpers and UTC date-key arithmetic to generate the seven dates.
4. Return orthogonal flags for planned, active and future rather than a misleading pass/fail score. A day can be unplanned and active.
5. Implement guarded account-scoped storage with a hydration/read result. Persist only on Save, keeping an unsaved draft separate from the saved preference.
6. Add weekday checkboxes, the duration selector and clear text that duration is a plan, not tracked time. Treat zero weekdays as a valid “no schedule set” state.
7. Render the current week with text labels and link active days to stats without assuming MID-13 exists. If that story is later present, add deep links as a separate integration.
8. On a timezone change, recompute the current week from current device time; do not reassign existing `xpByDay` values or emit `goal_set`.
9. Verify that Save/Reset controls never invoke progress mutation and that switching accounts discards another account's unfinished form draft.

**Validation:** Groups C and W. Test duplicate/invalid weekdays, Monday/Sunday boundaries, year crossover, zero selections and active unplanned days. Manually save a plan, reload, disable storage and confirm the UI does not promise a persisted schedule.

**Rollout / review checkpoint:** Local preferences only. Retain the dedicated key on code rollback. Explain the difference between a planned rest day and an alteration to the streak reducer.

---

## MID-15 — Edit an account display name

**User story:** As a signed-in learner, I want to edit my display name and see it consistently in the app without signing out and back in.

**Current gap and learning goal:** The database, AuthUser and `PATCH /me` already support `displayName`, and the web API wrapper already exposes `updateMe`; there is no complete settings flow. Learn authenticated mutation coordination rather than adding a redundant endpoint.

**Size and scope:** 3–4 days, web plus focused API validation if needed. Display name only, 0–80 characters with blank mapped to null. No email/password/timezone editor or new database columns.

**Read first:** [profile route](../apps/api/src/routes/me.ts), [API wrapper](../apps/web/src/lib/api.ts), [web provider](../apps/web/src/lib/progress.tsx), [auth storage](../apps/web/src/lib/progress-storage.ts), [Header](../apps/web/src/components/Header.tsx). New: `apps/web/src/app/settings/page.tsx` and focused request-coordination tests if a helper is extracted.

**Acceptance criteria**

- Settings shows the current display name, an explicit Save action, pending feedback and a truthful success/error message.
- Empty trimmed input clears the name; input over 80 characters is rejected before sending and remains server-validated.
- A token refresh during Save does not overwrite newer credentials or another account's user object.
- A delayed response after logout/account switch is ignored. Failed saves retain the draft.
- Name changes update the active context and other tabs through existing auth storage behavior; XP and the outbox stay intact.

**Implementation plan**

1. Trace the existing `updateMe` call inside timezone synchronization. Document where access-token refresh, current-token adoption and generation checks already occur.
2. Narrowly extract an authenticated operation mechanism or add a provider-owned profile action that reuses those rules. Do not copy a second independent refresh loop into settings.
3. Ensure profile mutation and sync token rotation use compatible single-writer/cross-tab coordination. Avoid nested acquisition of the same lock; test the chosen helper boundary explicitly.
4. Validate and normalize a draft in a pure helper. Send only `{ displayName }`; do not include stale `tz`, email or arbitrary AuthUser properties.
5. After a successful response, check the active account generation, then combine the returned user with the latest stored tokens. Never persist the access/refresh tokens captured before the request.
6. Account for concurrent timezone updates: serialize local profile operations and refresh the user view if a concurrent response may be stale. Preserve last-writer-wins semantics on the server rather than introducing hidden revisions.
7. Build the settings form with dirty/pristine state so a clock tick or background sync does not overwrite an actively edited draft. Reset deliberately on account switch.
8. Display `displayName` where a learner-facing account label is appropriate, falling back to existing behavior when null. Keep email available only where it identifies the signed-in account.
9. Verify the existing `PATCH /me` schema and add server tests for the exact bounds/clear behavior without changing other supported fields. Record the concurrency checks in the PR.

**Validation:** Groups W and A. Use deferred promises for save-versus-refresh, logout-before-response, account-A response after account-B login and failure retaining draft. Manually edit in one tab, observe another, clear the name and trigger sync during Save.

**Rollout / review checkpoint:** No migration. Older clients already understand nullable display names. Explain why spreading a stale `AuthTokens` object after Save can invalidate an otherwise successful session.

---
## MID-16 — End all current refresh-token sessions

**User story:** As a signed-in learner, I want to end my existing login sessions on other devices as well as this one, with a clear explanation of when they will require login again.

**Current gap and learning goal:** Logout currently revokes one refresh-token family. There is no account-wide action. Learn transactional revocation and distinguish refresh-session revocation from immediate invalidation of stateless access tokens.

**Size and scope:** 3–4 days, API and web. Password-confirmed revocation of all refresh tokens belonging to the authenticated user. No token denylist, access-token format change, account deletion, password reset or session-device tracking.

**Read first:** [auth routes](../apps/api/src/routes/auth.ts), [token verification](../apps/api/src/auth.ts), [refresh table](../packages/db/src/schema.ts), [auth integration tests](../apps/api/src/auth.integration.test.ts), [web logout](../apps/web/src/lib/progress.tsx). New: an API action, typed client method and a small account-security panel.

**Acceptance criteria**

- An authenticated request with the correct current password revokes every existing refresh-token family for that account and returns 204.
- Wrong password, missing auth or a missing account cannot revoke tokens; expensive verification uses the existing tighter auth rate-limit pattern.
- A concurrent refresh cannot resurrect a revoked family. Another user's families remain usable.
- The current client logs out only after confirmed success, keeping its existing account-scoped unsynced progress behavior.
- Copy explicitly states that already-issued access tokens may remain valid until their configured expiry; new logins after this action remain possible.

**Implementation plan**

1. Trace the existing logout/refresh account-row locking order and note the configured access-token TTL. Do not promise instant remote logout under the current stateless access-token design.
2. Add a strict body schema for the current password with the same upper bound as login. Require Bearer auth and use route-level rate limiting before expensive password verification.
3. Fetch the authenticated user's password hash and verify with the existing helper. Return a generic credential failure without returning hashes or logging the request body.
4. In a transaction, lock the same account row in the same mode used by refresh/logout, recheck account existence, and delete refresh-token rows by authenticated user ID.
5. Keep the linearization clear: families present when the revocation transaction wins are revoked; a later successful password login creates a new session. Do not broaden this into preventing future logins.
6. Add integration tests that race this action with refresh using different token generations. If a refresh response wins first, its replacement must still fail to refresh after revocation completes.
7. Add a provider-owned client action and a password-confirmation form with explicit explanatory text. Do not store the password in local storage, progress events or diagnostics.
8. On a confirmed 204, call the existing local logout/session-isolation path. On timeout, retain the account view and explain the outcome is unconfirmed; let the learner log out locally or retry rather than claiming success.
9. Reset password state on completion, cancellation and account change. Fence delayed responses so account A's result cannot log account B out.

**Validation:** Groups A and W with real disposable-Postgres integration tests. Cover wrong password, two users, multiple families, rotated tokens, concurrent refresh, account deletion and unknown request fields. Manually verify pending local progress stays in its account archive after the current client logs out.

**Rollout / review checkpoint:** No migration or JWT contract change. Add the API before exposing the control. Explain what remains valid immediately after refresh-token revocation and why that does not contradict the stated feature scope.

---

## MID-17 — Understand why a saved change was rejected

**User story:** As a learner, I want an understandable reason when the server cannot accept a saved change so I know whether to update the app or ask for help.

**Current gap and learning goal:** `/sync` already returns rejected IDs, and web displays a count. It does not expose stable reason categories. Learn additive response evolution while preserving batch settlement and avoiding reflection of untrusted payloads.

**Size and scope:** 3–4 days, API and web. Add bounded reason metadata to the existing sync response and a session-local explanation panel. Mobile must continue working with the old fields; a native detail UI is a follow-up, not a prerequisite.

**Read first:** [sanitizer](../apps/api/src/sync-validation.ts), [sync route](../apps/api/src/routes/sync.ts), [web sync loop](../apps/web/src/lib/progress.tsx), [Header notices](../apps/web/src/components/Header.tsx), [mobile worker](../apps/mobile/src/lib/sync-worker.ts). New: reason-code types/helper tests and a web details component.

**Acceptance criteria**

- The old `accepted`, `rejected` and `progress` fields keep their meaning and shape.
- New optional `rejectedDetails` entries contain bounded identifiers and stable codes, never raw event bodies or Zod messages containing submitted values.
- Valid sanitized/clamped events are not mislabeled as rejected. An unknown lesson ID still follows the current compatibility behavior.
- A successful batch still settles every sent event once, including rejected items; the detail feature must not requeue poison events.
- Account changes clear the visible diagnostic details; older servers without details still show a useful generic rejection notice.

**Implementation plan**

1. Inventory rejection paths in `eventSchema.safeParse`. Separate schema failures from successful XP/timestamp clamping; unknown catalog lessons are not currently a rejection category.
2. Define a small code set such as invalid shape, unsupported event type and invalid field, with a deterministic precedence for multiple issues. Derive codes from issue paths/types, not formatted error strings.
3. Extend the pure sanitizer result additively. Correlate only bounded identifiers; count uncorrelatable invalid items separately if needed rather than echoing attacker-controlled arbitrary text.
4. Keep `rejected` unchanged for compatibility and add `rejectedDetails` to the route response. Limit detail entries by the existing 500-item batch cap and bound every string field.
5. Add contract tests for a mixed valid/invalid batch, malformed nonobject items and long IDs. Confirm `accepted` still counts sanitized valid submissions rather than newly inserted database rows.
6. Extend the web response type with optional details. After existing storage settlement succeeds, accumulate at most 50 session-local details for the current account, with a truncation notice.
7. Map codes to calm learner-facing explanations and possible next actions. “Try the current app version” is appropriate for unsupported formats; do not suggest modifying raw progress JSON.
8. Add a disclosure beside the existing rejection count and a dismiss action that hides this session's notice without deleting progress or changing the outbox.
9. Verify an old-server fixture without details, an old-client contract fixture ignoring added fields and an account switch while a rejected batch response is pending.

**Validation:** Groups A and W. Test deterministic code precedence, bounded reflection, nonobject inputs, clamped-but-accepted events and unchanged poison-event settlement. Manually simulate a rejected fixture in a test account and confirm it does not repeat forever.

**Rollout / review checkpoint:** Deploy additive API fields first, then UI. Rollback can remove either consumer or optional producer independently. Explain why retaining rejected events for endless retry would make the explanation feature harmful.

---

## MID-18 — Download a sanitized troubleshooting report

**User story:** As a learner asking for help, I want to download a small technical report that describes the app's current state without exposing my account credentials or private answers.

**Current gap and learning goal:** The junior backlog proposes a personal progress summary. This report has a different purpose: bounded operational context for support, not learning totals or a restorable backup. Learn explicit data projection and testable privacy guarantees.

**Size and scope:** 2–3 days, web. User-triggered preview and JSON download under 10 KB. No automatic upload, third-party telemetry, raw logs or automatic screenshot capture.

**Read first:** [web provider](../apps/web/src/lib/progress.tsx), [API errors](../apps/web/src/lib/api.ts), [content version](../apps/web/src/lib/content.ts), [Header status](../apps/web/src/components/Header.tsx). New: `apps/web/src/lib/support-report.ts`, tests and a troubleshooting panel/page.

**Acceptance criteria**

- Preview shows exactly the report fields before download, with a clear statement that the user decides whether and where to share it.
- The report includes schema version, generated timestamp, course ID/version, a route category, pending-count and known sync/storage/session-status flags.
- It excludes names, email, user IDs, tokens, passwords, answer text, note text, URL query/hash, raw user agent, API/database URLs and event payloads.
- Unknown or unsupported information is explicitly unavailable; the report does not infer “online” solely from a browser connectivity hint.
- Download failure leaves a selectable text fallback. Object URLs and feedback timers are cleaned up.

**Implementation plan**

1. Define a `SupportReportV1` interface as an explicit allowlist. Treat fields as user-visible product data, not a dump of internal provider objects.
2. Implement a pure builder accepting only the allowed inputs and a timestamp argument. Map pathnames to categories such as course/lesson/words/stats/account/other; never include dynamic IDs or queries.
3. Validate numeric bounds and serialize only primitive values. Keep a serialized-size check so later additions cannot accidentally produce a huge report.
4. Expose any missing safe provider status through a narrow getter/value. Do not expose the underlying storage instance, auth object or outbox for the page to inspect.
5. Build a preview using normal text/JSON rendering, with a “Download report” button and clear labels for pending local changes versus server-confirmed state.
6. Generate a Blob from the exact preview snapshot and a generic timestamped filename. Revoke its object URL after the browser has had a chance to begin download, including cleanup on unmount.
7. If download APIs fail, provide a readonly textarea containing the same sanitized report and an explicit copy action with clipboard-error handling.
8. Add a redaction test that supplies sentinel secrets through wider fake input objects and verifies none can reach the output; test serialization against the exact documented allowlist.
9. Switch accounts while the page is open and replace the preview snapshot promptly. A user-triggered download must use the currently displayed report, not a stale closure over a prior scope.

**Validation:** Group W. Test every allowed field, unknown statuses, size limit, sensitive sentinel exclusion and deterministic timestamp injection. Manually preview, download, parse the JSON and exercise the fallback in a test browser.

**Rollout / review checkpoint:** No network or persistence contract change. Removing the page removes the feature; downloaded reports remain user-owned files. Explain why generic “redact sensitive keys” recursion is weaker than constructing an allowlisted report.

---

## MID-19 — See and control the next sync retry

**User story:** As a learner with an unreliable connection, I want to know when sync will retry and be able to request a retry without creating overlapping requests.

**Current gap and learning goal:** Web already retries, exposes sync status and uses locks/generation guards. The missing feature is an explicit retry schedule and countdown governed by one policy. Learn to integrate backoff with existing triggers instead of creating a second sync loop.

**Size and scope:** 3–5 days, shared policy and web first. Delays of 2, 5, 15, 30 and then 60 seconds for consecutive transient failures. No background service, cross-device scheduler or replacement of native retry behavior.

**Read first:** [web provider](../apps/web/src/lib/progress.tsx), [API request wrapper](../apps/web/src/lib/api.ts), [Header](../apps/web/src/components/Header.tsx), [mobile worker for contrast](../apps/mobile/src/lib/sync-worker.ts). New: a pure retry-policy helper/test and a provider scheduling adapter.

**Acceptance criteria**

- A transient failure shows the next retry time and pending count; successful sync resets the failure count.
- A definitive refresh-token 401 requires login and cancels automatic retry. It is not treated as a network outage.
- Automatic retries, online/focus triggers and manual actions all use one existing sync writer; no duplicate timers accumulate.
- Manual retry can request an immediate attempt subject to a small local cooldown and server rate-limit delay, without bypassing auth/session guards.
- Logout/account change/unmount cancels the old schedule; a late response cannot schedule a retry for a different account.

**Implementation plan**

1. Inventory every existing web sync trigger, lock, debounce and interval. Draw a single scheduling entry point that ultimately calls the current `syncNow` drain logic.
2. Define pure policy inputs: failure count, error category, current time, optional server retry-after delay and last manual attempt. Return the next permitted time or a login-required result.
3. Preserve request error categories from the API wrapper. Add bounded parsing for `Retry-After` if used, supporting seconds and valid HTTP dates, with a safe cap; do not pass raw headers into UI.
4. Implement one timer ref for scheduled sync and clear it before replacement. Read current provider state at firing time and fence it with the account generation captured when scheduled.
5. Apply the delay sequence to transient failures. A skipped cross-tab lock acquisition is not a failed network request and must not increment the failure count.
6. On success, reset the policy and countdown; if new events arrived during the request, preserve the existing drain behavior rather than delaying already-running valid work unnecessarily.
7. Route manual Retry through the same policy with a five-second local cooldown, while respecting any longer server delay. Disable the button during an active request and explain remaining wait time.
8. Render countdown using a lightweight display clock only while a retry is scheduled. Hidden-tab timer delays are acceptable; on focus recompute from the deadline instead of subtracting assumed ticks.
9. Remove or adapt existing retry triggers that would otherwise bypass the policy, while retaining periodic empty pulls if current behavior requires them. Avoid blocking an authenticated operation on a timer it itself must clear.
10. Add fake-clock and deferred-request tests before manual offline/online checks, including account switches and unmount cleanup.

**Validation:** Groups C and W if policy lives in core, otherwise W. Test delay sequence/cap, 401, 409 refresh contention, 429 with retry delay, success reset, lock skip, clock jump, focus after a delayed timer and one in-flight request. Manually toggle connectivity with pending work.

**Rollout / review checkpoint:** No event or server schema changes. Keep scheduling behind a small adapter so rollback can restore existing retry triggers. Explain why `navigator.onLine` and a fulfilled outer sync promise are not sufficient proof that progress reached the server.

---

## MID-20 — Pull to refresh progress on mobile

**User story:** As a mobile learner, I want to pull down on the course screen to sync and see whether my latest changes were saved or still need attention.

**Current gap and learning goal:** The native provider exposes `syncNow` and a pending count, but the worker catches failures internally and the screen lacks an explicit pull-refresh result. Learn to expose operation outcomes without creating a second worker or mistaking promise settlement for success.

**Size and scope:** 2–3 days, mobile. Pull-to-refresh plus status/last-success display for the current account. No content update/download trigger, new retry policy or background push notification.

**Read first:** [native course screen](../apps/mobile/app/index.tsx), [provider](../apps/mobile/src/lib/progress.tsx), [sync worker](../apps/mobile/src/lib/sync-worker.ts), [worker tests](../apps/mobile/src/lib/sync-worker.test.ts). New: narrowly scoped worker status types/tests and a course refresh/status component.

**Acceptance criteria**

- Pull-to-refresh uses the existing worker; concurrent automatic/manual calls still share one request/drain.
- Spinner ends for success, transient failure, guest/no-op, expired session and account change.
- Last-success time changes only after a server response has been committed successfully to local storage.
- Guest copy explains that progress is local; expired-session copy links to login without deleting pending events.
- Status reflects the current account and does not briefly display another account's last sync after switching.

**Implementation plan**

1. Trace how `syncNow`, `drain`, `push` and `commitSync` interact. Note that `syncNow` currently resolves after caught failures, so adding `.then(showSuccess)` would be wrong.
2. Define a worker observation contract with idle/syncing/error/login-required status and optional last-success timestamp. Keep it separate from auth and progress payloads.
3. Emit syncing once when a real drain starts. Emit success only after `commitSync` and the corresponding callbacks complete; report storage failure as failure without discarding pending data.
4. Guard every observation with the worker generation. Reset status/last-success when switching accounts, and provide a defined no-op result for guest calls.
5. Wire observations into provider state and expose only safe status values. Keep the worker constructed once and avoid adding a duplicate sync implementation to the screen.
6. Attach React Native's refresh control to the existing course `FlatList`, using worker state for refreshing. Do not nest another scrolling list to achieve the gesture.
7. Add a short status line for pending count, last confirmed sync and failure/login action. Format time locally and use accessibility announcements only for meaningful result transitions.
8. Preserve foreground/debounce/periodic triggers; they should update the same status and can coalesce with a pull gesture.
9. Test app background/foreground and account switching during a delayed response. Ensure the spinner stops even when the outgoing session is abandoned.

**Validation:** Group M. Extend worker tests for success-after-commit, commit failure, guest no-op, expired refresh token and ignored stale callbacks. Manually pull while offline, reconnect, pull repeatedly and confirm one consistent pending count without duplicated completions.

**Rollout / review checkpoint:** Existing storage and API contracts remain unchanged. Rollback can remove the observation callbacks and UI. Explain why the timestamp belongs after local commit, not immediately after fetch resolves.

---
## MID-21 — Review and safely activate mobile content updates

**User story:** As a mobile learner, I want to see when a new course version is ready and apply it between lessons so my current exercise never changes underneath me.

**Current gap and learning goal:** `refreshBundleIfNewer` currently downloads and swaps the active bundle in the background, while screens call `getBundle` directly. There is no staged-update choice or reactive activation contract. Learn validation, atomic persistence and consistent readers of versioned content.

**Size and scope:** 4–6 days, mobile and a platform-free runtime validator. One pending update and explicit activation outside lessons. No delta downloads, CDN redesign, multiple courses or binary app-update mechanism.

**Read first:** [mobile content](../apps/mobile/src/lib/content.ts), [root layout](../apps/mobile/app/_layout.tsx), [mobile API](../apps/mobile/src/lib/api.ts), [SQLite storage](../apps/mobile/src/lib/storage.ts), [core bundle types](../packages/core/src/types.ts), [mobile lesson route](../apps/mobile/app/lesson/[lessonId].tsx). New: content-state/validation helpers with tests and an update notice.

**Acceptance criteria**

- A newer manifest is checked without interrupting play; downloaded content becomes pending, not immediately active.
- Invalid JSON/structure, mismatched course/version or unsupported exercise fields cannot replace the last known-good bundle.
- “Apply update” is offered outside an active lesson and changes all content consumers together; a running lesson retains its original snapshot.
- Restart recovers the last committed active version, falls back to shipped content on invalid cache, and does not roll below a newer shipped version.
- Offline, failed download and failed persistence leave current lessons playable and expose a retryable update status.

**Implementation plan**

1. Inventory all `getBundle`, `findLesson` and memoized content consumers, including audio and stats. Record where a module-global swap currently fails to trigger a rerender.
2. Define content state with active bundle, optional pending bundle and update status. Add a provider/subscription boundary so screens observe one committed active identity.
3. Add a pure runtime decoder for the compiled bundle shape, distinct from the YAML authoring schema. Validate all seven exercise variants, required collections, stable IDs, version/course agreement and optional old-bundle fields; establish explicit size/count bounds based on the actual shipped artifact plus documented headroom.
4. Validate cached content during startup before accepting its version. Choose the newer valid shipped/cached bundle; isolate corrupt cached data rather than calling it valid because it has a large version number.
5. Change the refresh path to validate manifest name/version/course, download using the existing API path, validate the result, and store it under a separate pending key. Reject unsupported filenames rather than accepting arbitrary remote URLs.
6. Add a small update notice on the course screen with current/new version, Apply and Later. A failed check is informational and must not replace the course with an error page.
7. Give active lessons an explicit content snapshot/lease. Disable activation while a lesson is mounted, or defer it until that lease is released; do not infer safety solely from whether the course screen happens to be visible.
8. On Apply, atomically persist the new active record and remove the pending record, then publish one state change. If persistence fails, keep the prior active identity and pending update for retry.
9. Update memo dependencies and helper inputs to use the active content identity. Keep a lesson's own content and practice flag frozen; never reset user progress or purge unknown historical IDs during activation.
10. Add startup/update failure fixtures and a manual two-version scenario. Coordinate `_layout` audio behavior so it reads only committed active content; do not claim all recordings are downloaded just because a bundle activated.

**Validation:** Groups C and M if validation is in core, otherwise M. Test newer/older/shipped precedence, corrupt cache, course mismatch, version mismatch, missing exercise fields, persistence failure and interrupted pending activation. On a device, stage an update during a lesson, finish it, apply from course, restart and check consistent versioned titles.

**Rollout / review checkpoint:** Retain the existing active-cache compatibility path during migration and document the new pending key. Rollback must keep a valid active bundle and ignore the pending record. Explain why a TypeScript cast cannot validate downloaded JSON and why changing only the global variable is insufficient for mounted React screens.

---

## MID-22 — Download selected units for offline audio

**User story:** As a mobile learner, I want to download recordings for the units I plan to study and see which clips could not be downloaded, instead of automatically fetching the whole course.

**Current gap and learning goal:** Native startup already invokes `cacheAllAudio`, which walks all bundle audio references and counts attempted files. The missing feature is scoped, visible and cancellable download management with truthful coverage. Learn safe file publication and bounded work.

**Size and scope:** 4–5 days, mobile. Explicit downloads of exercise audio for selected units, one active job, sequential files. No audio generation, byte-perfect storage forecasting, background download service or eviction policy.

**Read first:** [native audio/cache](../apps/mobile/src/lib/audio.ts), [startup](../apps/mobile/app/_layout.tsx), [content](../apps/mobile/src/lib/content.ts), [audio tests](../apps/mobile/src/lib/audio.test.ts), [core types](../packages/core/src/types.ts). New: a unit-audio selector, download-job helper/tests and `apps/mobile/app/downloads.tsx`.

**Acceptance criteria**

- Selecting units produces a deduplicated list of their exercise audio files, with separate already-cached, downloaded, unavailable and failed counts.
- Only successfully downloaded nonempty audio is published to the playback cache; a failed/error-response file cannot shadow TTS fallback.
- Cancel stops scheduling new files. If a file is in progress, the UI says it is stopping after that request and does not falsely claim immediate cancellation.
- A retry skips valid cached files and retries only unresolved work; unavailable recordings are not labeled ready just because a reference exists.
- Startup no longer starts an overlapping whole-course download; existing cached recordings and offline lesson text continue to work.

**Implementation plan**

1. Trace `cacheAllAudio`, `localPath` and playback's cache-first lookup. Note that `bundle.audio` contains references even when recordings are absent on the server.
2. Add a pure selector that walks selected units' exercise `audio` refs, maps them through the bundle, validates allowed relative filenames and deduplicates physical files. Do not infer that all vocabulary for a unit is linked in the current model.
3. Define a job snapshot with content version, selected units, file states and cancellation flag. Freeze the selected content so a later bundle update does not change the current job.
4. Replace startup's unconditional all-audio job with an explicit Downloads entry. Reuse existing cache paths; do not delete already-downloaded files during this transition.
5. Process one file at a time. Download into a unique temporary file inside the audio directory, require a successful response plus a nonempty plausible audio result, and only then move it to the validated final cache path.
6. If a request fails or returns a missing clip, delete only its owned temporary file. Never construct deletion targets from raw URL/path input and never recursively clear the documents directory.
7. Implement cancellation between files and check it again before publication. If cancellation occurs during a request, settle/clean up that request before declaring the job stopped; a late callback must not start the next item.
8. Render counts from explicit file states, not a single attempted/total percentage. Explain that TTS may still work for unavailable recordings but is device-dependent offline.
9. Implement retry by rebuilding unresolved work against the current validated bundle/cache. Keep one job owner so repeated button presses or route remounts cannot duplicate downloads.
10. Handle leaving the screen with a documented choice: the job remains owned by a provider until cancelled/completed, with a visible return link. Verify errors and cleanup using fake file/network adapters before device testing.

**Validation:** Group M and C if the selector is shared. Test duplicate refs, traversal-like filenames, 404, nonaudio/error payload, truncated/empty file, disk failure, late completion after cancel and retry reuse. Manually download a small unit, switch to airplane mode and play a recorded clip plus a missing-recording case.

**Rollout / review checkpoint:** Cache-compatible feature; no database migration. Rolling back must not destroy cached clips. Explain why “attempted every URL” is not equivalent to “all audio is available offline.”

---

## MID-23 — Get a web course-version update notice

**User story:** As a learner with the web app open during a deployment, I want to know when the API advertises a newer course version and reload at a convenient time.

**Current gap and learning goal:** Web imports its bundle at build time, while the public manifest advertises a version. There is no version-comparison notice. Learn to respect the deployed application's content boundary instead of hot-swapping downloaded JSON into a built client.

**Size and scope:** 2–3 days, web. A best-effort check at startup and throttled focus, with explicit reload outside lessons. No service worker, runtime web bundle replacement or guarantee that an independently deployed API version is already available in the web build.

**Read first:** [web content](../apps/web/src/lib/content.ts), [content endpoints](../apps/api/src/routes/content.ts), [web API](../apps/web/src/lib/api.ts), [Header](../apps/web/src/components/Header.tsx), [Vercel guide](../docs/VERCEL.md). New: manifest-check helper/test and a version-notice component.

**Acceptance criteria**

- Only a validated newer manifest for the same course produces a notice; older/equal versions and offline failures do not block play.
- The notice says a newer course is available from the server and offers a reload, without claiming that reload necessarily changes a separately deployed web app.
- No automatic reload occurs during a lesson or while local progress is unsafely held only in memory.
- Dismissing a version suppresses repeated notices for that version in the current tab, while a later version can be shown.
- Repeated focus events are throttled and stale responses cannot update an unmounted checker.

**Implementation plan**

1. Read how the API base URL and Vercel embedded route are configured. Add a typed manifest request to the existing wrapper instead of hardcoding an origin.
2. Validate course ID, positive integer version and expected bundle-name shape in a pure parser. Treat malformed or mismatched responses as unavailable checks, not updates.
3. Implement a comparison helper against the imported web bundle version; never assign downloaded content to the exported web `bundle` constant.
4. Add one app-level checker with a five-minute focus throttle, one in-flight request and cleanup/generation protection. Existing request timeouts still apply.
5. Track the highest validated newer version and a tab-local dismissed version. Avoid persisting an unbounded list of every historical version.
6. Render the notice outside lesson routes. If an update is detected during a lesson, retain the notification state until the learner leaves; do not disturb current focus or feedback.
7. Before reload, inspect provider readiness, pending count and storage failure. Allow an explicit sync attempt; block the feature's reload action when unsynced changes exist only in memory, and explain how to save them first.
8. Use an explicit browser reload only after the learner chooses it. Never clear caches, local storage, auth or the outbox to force an update.
9. If the app returns with the same imported version, explain the web deployment may not contain that course yet; do not enter a reload loop or repeatedly auto-open a dialog.

**Validation:** Group W. Test same/older/newer/mismatched manifests, malformed version, failed requests, throttled focus and delayed response after unmount. Manually use a mocked newer manifest during a lesson and with a simulated storage failure plus pending events.

**Rollout / review checkpoint:** Read-only API consumption. Removing the checker returns current behavior. Explain why a newer API manifest is not proof that this browser's currently served JavaScript contains the newer course.

---

## MID-24 — Find contextual help inside the app

**User story:** As a learner, I want searchable help linked from confusing states so I can understand hearts, practice, placement and synchronization without leaving the app.

**Current gap and learning goal:** Important explanations are scattered across notices and repository docs. There is no structured in-app help library with stable links. Learn content modeling and context-sensitive navigation while keeping explanations aligned with actual code.

**Size and scope:** 2–3 days, web. Eight initial articles written from current behavior: starting lessons, placement, practice, hearts, review, goals/quests, offline sync and audio fallback. No chatbot, CMS, support messaging or search backend.

**Read first:** [hearts](../packages/core/src/hearts.ts), [review](../packages/core/src/review.ts), [events](../packages/core/src/events.ts), [Header notices](../apps/web/src/components/Header.tsx), [audio](../apps/web/src/lib/audio.ts), [web storage](../apps/web/src/lib/progress-storage.ts). New: `apps/web/src/lib/help-content.ts`, validation tests, `/help` and `/help/[slug]` pages.

**Acceptance criteria**

- All eight articles have stable unique slugs, concise summaries, searchable headings/body and related in-app links.
- Relevant existing empty/error states link to a specific article, preserving normal recovery controls.
- Claims match source behavior, including smaller practice rewards, possible TTS unavailability and the limits of local guest persistence.
- Unknown slugs and no search results show useful recovery paths. Articles work without login.
- Help never exposes implementation jargon unless it helps the learner choose an action, and never promises unimplemented backlog features.

**Implementation plan**

1. Trace each article's topic to the source listed above and write a short claim checklist before drafting. In particular distinguish practice from first completion and saved-local from confirmed-synced.
2. Define a typed article shape with slug, title, summary, ordered text sections and related slugs/routes. Use plain structured text rather than a raw HTML/Markdown execution pipeline.
3. Draft the eight articles using current product terms. Keep developer file names, token mechanics and database details out of learner instructions.
4. Add tests for unique slugs, required fields, nonempty sections and valid related-article references. Do not snapshot entire prose as the primary quality check.
5. Build a search/filter helper using existing normalization over titles, summaries and sections, with stable article order for ties.
6. Add the help index and detail route, page titles and semantic headings. Preserve query state when returning from an article so a learner need not repeat a search.
7. Add contextual links beside out-of-hearts, empty-review and sync/session notices. Leave retry/login/back controls where they are; help is an additional path.
8. Use native links and normal text rendering, with clear focus/keyboard behavior and readable line lengths on mobile width.
9. Walk each article's instructions in the current app using a test/guest account and correct any unsupported claims. Add a short maintainer note identifying the source areas that should trigger future help review.

**Validation:** Group W and manual content review. Test slug/reference validation, accent-insensitive search, unknown route and empty query/results. Demonstrate out-of-hearts → help → course and sync-error → help → retry without losing local progress.

**Rollout / review checkpoint:** Static app content only. Rollback removes routes and contextual links. Explain why linking to a troubleshooting article is helpful only when the original recovery action remains available.

---

## MID-25 — Prepare an exercise problem report

**User story:** As a learner, I want to prepare a report about a confusing exercise with its identifying context so I can give the maintainer enough information to reproduce the issue.

**Current gap and learning goal:** Exercises have stable IDs and versioned content, but learners have no way to gather that context. This is distinct from the technical report in MID-18: it describes a specific content problem and learner-written explanation.

**Size and scope:** 2–3 days, web. User-triggered preview and Markdown/text download or copy. No automatic external submission, issue-tracker integration, database table or unsolicited message sending.

**Read first:** [player](../apps/web/src/components/LessonPlayer.tsx), [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [content types](../packages/core/src/types.ts), [bundle lookup](../apps/web/src/lib/content.ts). New: report-builder helper/test and an exercise-report panel.

**Acceptance criteria**

- A report includes course/version, lesson/exercise IDs, exercise type, a selected category and a bounded learner description.
- The preview shows every included field before copy/download and clearly states that nothing has been sent automatically.
- Canonical answers or the learner's response are not automatically included; the learner can describe what happened in their own words.
- Opening a report preserves the current lesson/feedback and does not submit an answer, consume hearts or complete a lesson.
- Account changes/unmount discard the report draft; clipboard/download errors provide a selectable fallback.

**Implementation plan**

1. Define report categories such as translation, audio, accepted answer, unclear prompt and other, plus a description limit of 1,000 characters. Keep optional contact information out of this first version.
2. Build a pure serializer accepting an explicit content snapshot and draft. Escape Markdown heading/fence characters in user text or render it in a safe plain-text section; do not serialize the exercise object.
3. Add a “Report this exercise” action during answering/feedback and capture the displayed exercise identity at opening. If the session later advances, the report still refers to that captured exercise.
4. Use an inline panel to avoid a modal focus trap. While editing it, suppress the player's global answer shortcuts so Enter in the description cannot submit Check or Continue.
5. Keep the player's state mounted and unchanged. Do not call `submitAnswer`, `addEvents` or navigation from report-open/close callbacks.
6. Render category, description, preview and explicit copy/download actions. Explain that the user can share the file through their normal channel; do not invent a maintainer address.
7. Generate a generic filename from safe IDs or sanitized fixed prefixes. Manage Blob URLs and awaited clipboard writes with error feedback and a readonly fallback.
8. Limit report drafts to component memory and clear them on account change. Avoid attaching pending events, auth state, URLs with query parameters or private note text.
9. Verify the report against a current exercise in every type, including matching and dialogue, to ensure identity capture works without assuming a single `prompt`/`answer` field.

**Validation:** Group W. Test serialization bounds, newline/Markdown escaping, all exercise type identifiers, sentinel-secret exclusion and stable snapshot after advance. Manually open while answering, type Enter, close, complete the lesson and inspect the downloaded report.

**Rollout / review checkpoint:** No external write or backend contract. Removing the action removes the feature. Explain why a report tied to `currentExercise()` at download time could describe the wrong exercise.

---
## MID-26 — Compare two curriculum bundles semantically

**User story:** As a content maintainer, I want a readable comparison between two compiled course versions so I can review learner-visible changes and risky ID changes before a release.

**Current gap and learning goal:** Compilation and semantic validation already exist, and the junior backlog proposes a one-bundle inventory. This feature compares two immutable artifacts by identity and meaning rather than counting one artifact or showing a huge raw JSON diff.

**Size and scope:** 3–4 days, content tooling. A local read-only CLI with Markdown and optional JSON output. No automatic edits, network downloads, content migration or integration with a hosted review service.

**Read first:** [compiler](../packages/content/src/compile.ts), [types](../packages/core/src/types.ts), [semantic validation](../packages/content/src/validate.ts), [content scripts](../packages/content/package.json), [content README](../packages/content/README.md). New: `packages/content/src/bundle-diff.ts`, `bundle-diff-cli.ts` and fixtures/tests.

**Acceptance criteria**

- The report identifies added/removed units, lessons, exercises and vocabulary by stable ID, with before/after parent location where something moved.
- Changes to exercise type, accepted answers, grading flags, XP, ordering and visible wording are classified separately.
- Removed IDs and changed answer/type contracts are clearly marked for review, without claiming an automatic data migration has been performed.
- Output is deterministic for the same inputs, regardless of JSON object-key order, and does not modify either bundle.
- Invalid input or duplicate IDs fail clearly; unknown CLI flags and identical paths do not silently compare unexpected files.

**Implementation plan**

1. Define the comparison contract and report categories before writing a CLI. Distinguish exact identity from text similarity: renamed IDs are remove/add, not a guessed move.
2. Build validated identity maps with parent paths for both bundles. Reject duplicate IDs and incompatible course IDs; allow equal versions for local drafts but flag them when content differs.
3. Canonicalize object-key ordering for comparison while preserving meaningful array order such as lessons, word banks and dialogue lines. Do not sort arrays indiscriminately.
4. Compare known fields by category, including all exercise variants. For accepted-answer alternatives, decide and document whether order is meaningful; preserve the primary answer distinction.
5. Detect moves through unchanged IDs with changed parents and detect order changes within parents. Report removed IDs explicitly because they may remain in historical progress/review queues.
6. Produce a machine-readable result first, then a Markdown renderer with escaped table cells and bounded excerpts. Include counts and detailed IDs without dumping the entire course text.
7. Add a thin CLI taking explicit `--before` and `--after` paths plus output format. Read the files directly; never import `compile.ts`, whose entry point currently runs on import.
8. Keep stdout for the report and stderr for usage/errors. Default exit 0 means a valid comparison was produced; input failure is 1. An optional `--fail-on-risk` can return 2 for marked risky changes, with that behavior documented.
9. Add a script such as `diff:bundles` using the existing `tsx` dependency, and document a command example with two explicitly named fixture or saved artifact paths.
10. Test the complete CLI with temporary input files and confirm their bytes and modification times are untouched. Do not run generators or write into `dist` to create the report.

**Validation:** Group T and C if shared types change. Fixtures cover no difference, object-key reorder, lesson reorder, move, removed exercise, changed accepted answer, changed grading flag, duplicate ID, malformed JSON and Markdown control characters. Run the new command twice and compare report bytes.

**Rollout / review checkpoint:** Tooling-only feature with no application rollout. If CI adoption is later desired, review the initial risk classification before making it blocking. Explain why a small textual diff can still contain a major content-identity change.

---

## MID-27 — Read authored explanations after answering

**User story:** As a learner, I want an authored explanation after answering a tricky exercise so I can understand the rule behind the answer.

**Current gap and learning goal:** Exercises already have optional hints, but those are not a dedicated post-answer explanation field. Learn to carry an optional feature through YAML schema, compiler, shared types and both renderers without making old bundles invalid.

**Size and scope:** 3–4 days, content, core types and both apps. Optional plain-text `explanation`, maximum 800 characters. A small reviewed sample of authored exercises plus complete fixture coverage. No generated grammar claims or mass curriculum rewrite.

**Read first:** [authoring base schema](../packages/content/src/schema.ts), [compileExercise](../packages/content/src/compile.ts), [ExerciseBase](../packages/core/src/types.ts), [web player](../apps/web/src/components/LessonPlayer.tsx), [mobile player](../apps/mobile/src/components/LessonPlayer.tsx), [generator guidance](../packages/content/generator/README.md).

**Acceptance criteria**

- Missing explanations preserve existing behavior in older bundles and current exercises.
- Present explanations survive compilation for every exercise type and appear only after an attempt has been submitted.
- Text is safely rendered as text, readable in both themes and never used as answer input or grading data.
- Matching exercises with an explanation get a deliberate post-grid explanation step without duplicate completion/heart effects.
- Empty/overlong authored explanations fail with a useful location, and content samples are edited at their actual maintained source.

**Implementation plan**

1. Add the optional bounded field to the shared authoring base and `ExerciseBase`. Keep the field name consistent or document an explicit compiler mapping.
2. Thread the field through every `compileExercise` branch. Use a small common metadata helper only if it avoids omissions without refactoring the entire compiler.
3. Add compiler fixtures covering all seven compiled types, no-field compatibility and schema failures. Ensure generated JSON does not gain meaningless empty strings.
4. Render the explanation in normal feedback after Check using the frozen displayed exercise, with a clear heading and paragraph whitespace preserved.
5. For matching, preserve the existing immediate path when there is no explanation. When there is one, store the already-computed next session in a feedback phase and advance only after Continue, retaining one grid-completion guard.
6. Keep heart-loss timing and outcome calculation exactly once at the existing accepted grid callback; do not run `submitAnswer` again when dismissing the explanation.
7. Implement the same optional behavior on mobile using its existing feedback controls and scroll layout. Large explanations must not push Continue beyond reachable content.
8. Locate the actual author-maintained source for a few sample exercises before editing; if generated, modify the owning template/data rather than generated YAML. Have the explanation wording reviewed as content, not assumed correct from code tests.
9. Rebuild content through the normal versioning workflow for the eventual feature and inspect the diff for unintended ID, XP, shuffle or unrelated content changes.
10. Verify correct answer, wrong answer/retry, matching with mistakes and final-exercise explanation on both clients. Completion must occur once after the final transition.

**Validation:** Groups T, C, W and M. Test field round-trip, length limits, absent compatibility and each affected state transition. Manually check a long explanation on a narrow browser and native large text, including a final matching grid.

**Rollout / review checkpoint:** Readers should ship with optional-field support before publishing content that relies on the new presentation. Older readers ignore the extra field; no progress migration is needed. Explain why a pre-answer hint and a post-answer explanation need different presentation timing.

---

## MID-28 — Filter vocabulary by authored topic tags

**User story:** As a learner, I want to filter the phrasebook by topics such as food or transport so I can prepare for a specific situation.

**Current gap and learning goal:** Vocabulary already supports lemma, translation, notes and audio, but it has no explicit topic relationship. Learn a small taxonomy from authored schema to compiled data and combined filters, without pretending keyword guesses are authoritative tags.

**Size and scope:** 3–4 days, content, shared types and web. A small declared topic catalog and optional per-entry topic IDs; one active topic filter. Mobile keeps loading old/new bundles without a topic UI in this first version.

**Read first:** [course/vocab schemas](../packages/content/src/schema.ts), [compiler](../packages/content/src/compile.ts), [VocabEntry and CourseBundle](../packages/core/src/types.ts), [phrasebook](../apps/web/src/app/words/page.tsx), [generator documentation](../packages/content/generator/README.md). New: focused topic-validation/filter tests.

**Acceptance criteria**

- Course metadata can declare unique topic IDs/titles, and vocabulary may reference zero or more declared IDs.
- Unknown/duplicate topic references and malformed catalogs are caught during compilation with entry context.
- Web search, letter filter and topic filter combine before paging; counts describe the active result set.
- Untagged entries remain visible under All and a defined Untagged option. Old bundles without the taxonomy behave as today.
- Tags do not change vocabulary IDs, answer grading, lesson unlocks or rewards.

**Implementation plan**

1. Define the exact additive shapes: authored course `vocab_topics: [{ id, title }]`, authored vocabulary `topic_ids`, compiled `vocabTopics` and `VocabEntry.topicIds`. Use bounded stable IDs/titles and at most eight tags per entry.
2. Add optional schemas and runtime types. Keep existing required fields and old-bundle loading unchanged; absent topic arrays should behave as empty.
3. Validate unique catalog IDs, duplicate entry refs and membership in the declared catalog. Use a Set lookup and include the vocabulary ID in every error message.
4. Map metadata/entry tags explicitly in the compiler, preserving authored catalog order. Do not infer topics from words or copy all notes into tags.
5. Add fixtures with two topics, one multi-tag entry, one single-tag entry and one untagged entry. Include unknown, duplicate and absent-data cases.
6. Add a small reviewed initial taxonomy to maintained content sources. Trace generated vocabulary ownership before editing, and avoid a mass automatic tagging pass in this story.
7. Add a labeled web topic select with All and Untagged options. Apply it alongside existing search/letter filters before calculating pages and reset page on selection changes.
8. Show topic labels on entries when available and provide useful zero-result copy that names the active filters. Do not require the junior favorite or hidden-note features.
9. Check mobile and API types against the additive bundle fields. If a runtime decoder from MID-21 has since landed, explicitly extend its allowed shape; do not treat that optional story as already present.
10. Compile through normal tooling and inspect the resulting change: existing IDs, translations and exercise ordering must remain stable except for intentional sample metadata.

**Validation:** Groups T, C and W, plus M typecheck for bundle-consumer compatibility. Test combined filters before paging, multi-tag membership, untagged behavior, empty taxonomy, duplicate IDs and compiler error context. Manually clear filters independently and reload an old fixture bundle.

**Rollout / review checkpoint:** Additive content field; publish reader support and content in a compatible order. Rollback may ignore tags without deleting authored metadata. Explain why declared topic IDs are easier to maintain than deriving categories from mutable display titles.

---

## MID-29 — Print a unit worksheet and separate answer key

**User story:** As a learner, I want a printable worksheet for a chosen unit with the answers in a separate section so I can practice away from a screen.

**Current gap and learning goal:** The app renders interactive exercises but has no print-oriented projection. Learn exhaustive handling of a discriminated union and layout designed for a different output medium without reusing a component that writes progress.

**Size and scope:** 3–4 days, core and web. A user-selected subset of 1–5 real lessons from one unit, worksheet plus optional separate answer-key section. No PDF server, headless-browser service, official assessment scoring or offline audio embedding.

**Read first:** [exercise types](../packages/core/src/types.ts), [grading/model answers](../packages/core/src/grading.ts), [web content](../apps/web/src/lib/content.ts), [CSS](../apps/web/src/app/globals.css), [course page](../apps/web/src/app/page.tsx). New: `packages/core/src/worksheet.ts`, tests, and `apps/web/src/app/worksheet/[unitId]/page.tsx`.

**Acceptance criteria**

- The learner chooses up to five lessons in a unit and previews worksheet content before invoking the browser print dialog.
- Every exercise variant has an intentional printable form; listening is labeled as requiring app audio rather than silently displaying its answer as the prompt.
- The answer key is on a separate print section and can be excluded entirely from the DOM/print output.
- Printing/previewing grants no progress, never mounts `LessonPlayer`, and does not promise that public bundle content is a secure exam.
- Output stays readable in monochrome on A4/Letter-sized pages, with room for written responses and identifiable course/version/lesson labels.

**Implementation plan**

1. Define a pure worksheet projection with prompt blocks, answer spaces and a separate answer-key model. Keep HTML/CSS and browser printing outside core.
2. Implement an exhaustive switch over all seven types. Choice uses a deterministic shuffled option list without marking the correct one; translation/arrange use prompt plus writing space; fill-blank preserves its blank.
3. Render matching as two independently ordered columns with labels, and dialogue as ordered speaker lines plus numbered blank spaces. Preserve repeated words/blank order rather than deduplicating them.
4. For listening, print an instruction and an app lesson reference so the learner knows audio is needed. Put canonical/accepted answers only in the key; do not invent a transcript from a potentially different audio ref.
5. Include canonical answers and labeled accepted alternatives in the separate key. For matching/dialogue, preserve the correct pair/blank relationship using the existing typed content.
6. Add the unit route with a bounded lesson selection and unknown-ID state. Resolve selection from real unit membership; exclude synthetic review and do not trust arbitrary query data as content.
7. Render the preview with an explicit answer-key toggle. When off, omit the key rather than hiding it only with color or offscreen CSS.
8. Add scoped print CSS: hide navigation/buttons, use high-contrast text, separate the key with a page break and avoid splitting short question blocks where practical. Let large blocks break rather than overflow a page.
9. Add a Print button that invokes the browser only after selection is ready. Show a brief note that browser print settings determine paper size and margins.
10. Review representative output for each exercise type using print preview. Do not serialize exercises to external PDF services or write worksheet events.

**Validation:** Groups C and W. Fixtures cover every type, multiple dialogue blanks, matching pairs, alternate answers, missing optional fields and zero/over-limit selections. Manually inspect A4 and Letter previews, monochrome, long prompts and key-off output; confirm progress remains unchanged.

**Rollout / review checkpoint:** Read-only route and static styling; no migration. Rollback removes links/routes. Explain why mounting the interactive player inside a print page risks unintended side effects even when its buttons are hidden.

---

## MID-30 — Browse a server-confirmed account activity timeline

**User story:** As a signed-in learner, I want to browse a chronological list of changes the server has received so I can distinguish confirmed activity from work still waiting on this device.

**Current gap and learning goal:** `/me` and `/sync` return derived progress, while PostgreSQL stores the underlying events. There is no bounded, read-only activity feed. This is separate from MID-09's in-memory answer recap and the junior progress download. Learn safe event projections and keyset pagination.

**Size and scope:** 4–5 days, API and web. New authenticated `GET /me/activity`, 20 items by default and at most 50, with an opaque cursor. No raw event export, event editing/deletion, real-time subscription or historical XP re-accounting.

**Read first:** [progress event table/index](../packages/db/src/schema.ts), [server progress loading](../apps/api/src/progress.ts), [profile routes](../apps/api/src/routes/me.ts), [sync semantics](../apps/api/src/routes/sync.ts), [web API](../apps/web/src/lib/api.ts), [provider](../apps/web/src/lib/progress.tsx). New: an activity projection/cursor helper, route tests and `apps/web/src/app/activity/page.tsx`.

**Acceptance criteria**

- Only the authenticated user's rows are returned; limit/cursor validation rejects malformed or oversized input.
- Pagination orders by `occurredAt DESC, id DESC` and handles equal timestamps without duplicates on an unchanged dataset.
- Responses contain allowlisted display fields, never raw payloads, auth data or another user's records.
- The UI labels this as server-received activity, keeps pending local work separate and does not sum claimed event XP as authoritative awarded XP.
- Refresh starts a new first page. Changes arriving during pagination follow a documented live-feed behavior rather than a false snapshot guarantee.

**Implementation plan**

1. Define an activity item union for lesson completion, heart change, goal change and tier placement, plus a safe unknown-type fallback for future compatibility. Include event ID/time and only fields required for understandable display.
2. Document that stored payloads are sanitized client claims: for example, the reducer can treat a later completion as practice even when its stored flag differs. Label a row “Lesson session recorded” and avoid claiming an exact per-row XP award unless it is derived correctly.
3. Define a versioned base64url cursor containing the last timestamp and UUID. Bound its encoded length, decode/validate both fields, and treat it as pagination input rather than authorization or proof of ownership.
4. Add an authenticated GET route with limit bounds and a database query always constrained by `req.userId`. For later pages use `occurred_at < cursorTime OR (occurred_at = cursorTime AND id < cursorId)` with the matching descending order.
5. Fetch limit plus one rows to determine `hasMore`, return at most limit items and derive the next cursor from the last returned row. Use database UUID ordering consistently; do not mix a different JavaScript comparator into paging.
6. Project payloads through runtime-checked allowlists. Resolve current lesson/track names when available but retain a generic historical label for removed content IDs; do not make the entire feed fail on one unfamiliar event.
7. Register the route in the existing child context with private/no-store behavior. Add typed API calls and use provider-owned authenticated coordination or a narrowly extracted equivalent, without reading tokens in the page.
8. Build initial loading, empty, error/retry and Load more states. Keep page state keyed by account generation, discard stale responses and deduplicate returned event IDs defensively.
9. Display pending local count separately with the existing Sync action. After a successful user-requested refresh, clear prior pages and fetch the first page; do not merge a freshly sorted first page into an old cursor chain silently.
10. Document live pagination: a newly synced older event can appear on a later page or require refresh if its position has already been passed. A strict database snapshot across requests is outside scope. Verify the existing user/time index on a realistic disposable fixture before proposing an extra index.

**Validation:** Groups A and W with disposable-Postgres integration tests. Cover two users, identical timestamps, exact page boundary, empty page, malformed cursor, removed content ID, unknown event shape and delayed A response after B login. Test inserted older/newer events between requests against the documented refresh behavior.

**Rollout / review checkpoint:** Add the read-only API before its page. No migration is expected unless query evidence justifies an index, which must be reviewed as an additive change. Explain why pagination stability, event idempotency and an immutable historical snapshot are three different guarantees.

---

## Finishing a story and requesting review

A story is finished only when its acceptance criteria, failure paths and relevant compatibility behavior have been demonstrated. A passing typecheck alone does not verify account isolation, transactional races, file cleanup or a correct print layout.

Before requesting review:

1. Read the final diff and remove unrelated edits, generated artifacts and secrets. Confirm the feature stayed within its stated platform and storage scope.
2. Run the story's verification groups and the relevant manual scenarios. For database work, state explicitly whether real integration tests ran with a disposable database or were skipped.
3. Recheck interactions with stories that landed meanwhile, especially shared player callbacks, provider-owned authenticated requests, audio ownership and optional content decoders. Resolve overlap by updating the final design, not by copying older files over newer work.
4. Complete the relevant release/build checks from the setup section. Do not deploy or migrate production merely because this backlog includes a rollout paragraph.
5. Write the PR around the final learner/maintainer behavior, the important contract, test evidence and rollback. Answer the story's review question in your own words.

Suggested PR outline:

~~~text
Story: MID-XX — <feature title>
Problem and new behavior: <one concrete before/after example>
Scope: <platforms, persistence and explicit first-version limits>
Contract: <important data shape, state transition or compatibility choice>
Validation: <commands that ran, meaningful scenarios and outcomes>
Rollout and rollback: <migration/order if needed; what data is preserved>
Codebase learning: <answer to the story's review checkpoint>
~~~

**Implementation boundary:** This document adds 30 specifications and implementation plans only. None of the proposed routes, components, helpers, migrations, tests, content fields or product features has been implemented as part of this documentation task.

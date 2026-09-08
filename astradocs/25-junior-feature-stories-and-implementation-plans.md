# 25 junior-friendly feature stories for Aral

Planning document only. None of the features below were implemented as part of writing this file.

Prepared against the source available on 2026-09-08, including release revision **74e9a21**. Recheck the named functions before starting if another contributor has changed them. Paths in **Read first** link to existing files; paths marked **new** are proposed files for the learner to create later.

## How to use this backlog

Pick **one story per branch and pull request**. The stories are deliberately small product slices, not a requirement to build a new platform. Most need no API change, no database migration, and no new dependency. Estimates are focused implementation time after local setup; a junior developer should allow additional time for reading, debugging and review. A 6-hour estimate is not a deadline.

The implementation steps are intentionally specific. First trace the existing flow, then make the smallest change, then exercise the acceptance criteria. Stop at the stated scope. Optional follow-ups are not part of the story. Except where explicitly mentioned, every story can be started independently. If two stories propose touching the same component, merge one first and rebase the other normally; do not copy an older component over newer work.

These are **new feature requests**, not a copy of the older training tickets. The app already has course search, track placement, paging, phrasebook search, password visibility, sync status, API timeouts, auth rate limiting, readiness checks and release CI. Those features are starting points here, not work to implement again. Some descriptions in [the older learning material](../docs/upskill/README.md) predate the current app; use the actual source as the source of truth.

### Suggested learning order

| Story | Feature | Primary area | Approximate effort | Main skill |
| --- | --- | --- | --- | --- |
| US-01 | Remember course browser preferences | Web | 4–6 hours | React state and defensive browser storage |
| US-02 | Jump back to the current unit | Web | 2–4 hours | Derived state and pagination |
| US-03 | Share a phrasebook search link | Web | 4–6 hours | URL state and navigation events |
| US-04 | Expand/collapse the visible unit cards | Web | 3–5 hours | Controlled disclosure state |
| US-05 | Show estimated lesson time | Core + web | 3–5 hours | Pure functions and boundary tests |
| US-06 | Preview a lesson before starting | Web | 4–6 hours | Reusable read-only UI and accessibility |
| US-07 | Explain lesson keyboard shortcuts | Web | 2–4 hours | Discoverability and keyboard behavior |
| US-08 | Confirm the explicit Quit lesson action | Web | 4–6 hours | Local state and exit behavior |
| US-09 | Show first-try accuracy after a lesson | Core + web | 4–6 hours | Deriving metrics from a state machine |
| US-10 | Clear an unfinished word-bank answer | Web | 2–4 hours | Child-to-parent state updates |
| US-11 | Toggle automatic answer audio | Web | 4–6 hours | Preferences and side-effect boundaries |
| US-12 | Choose a text-to-speech speed | Web | 5–7 hours | Optional parameters and browser API mocks |
| US-13 | Save favorite vocabulary on this device | Web | 1–2 days | Account-scoped local data |
| US-14 | Copy a phrase and its translation | Web | 3–5 hours | Async browser APIs and failure feedback |
| US-15 | Show/hide phrasebook notes | Web | 2–4 hours | Display preferences without data loss |
| US-16 | Display a word of the day | Core + web | 4–6 hours | Deterministic selection and time zones |
| US-17 | Practice vocabulary with reveal cards | Web | 5–7 hours | A small local UI state machine |
| US-18 | Add a last-seven-days summary | Core + web | 4–6 hours | Calendar arithmetic and aggregation |
| US-19 | Filter achievements by earned status | Web | 2–4 hours | Derived lists and accessible filters |
| US-20 | Add a 1,000-distinct-lessons badge | Core + both apps | 4–6 hours | Shared rules and regression boundaries |
| US-21 | Set a custom daily XP goal | Web | 5–7 hours | Validated input and existing progress events |
| US-22 | Download a personal progress summary | Web | 5–7 hours | Explicit serialization and file downloads |
| US-23 | Put mobile account actions within reach | Mobile | 4–6 hours | React Native layout and context reuse |
| US-24 | Add a lightweight public course overview API | API | 1–2 days | Request handling, projections and injection tests |
| US-25 | Generate a content inventory report | Content tooling | 1–2 days | Pure report generation and a small CLI |

For a first-ever contribution, start with US-14, US-15 or US-19. Then try US-02 or US-10. Work through a pure-core story before US-21. Leave US-13, US-24 and US-25 until you are comfortable following existing tests. These are small junior projects, but they still deserve normal code review.

## Codebase orientation and working rules

### A map to read once

| Responsibility | Start here | What to notice |
| --- | --- | --- |
| Course and exercise data types | [types.ts](../packages/core/src/types.ts) | A bundle contains tiers, units, lessons, exercises and vocabulary; IDs are stable references. |
| Search and next-lesson selection | [discovery.ts](../packages/core/src/discovery.ts) | Search normalization is deliberately separate from answer grading. |
| Lesson session state | [session.ts](../packages/core/src/session.ts) | Answering returns new state; wrong answers can requeue an exercise. |
| Progress events and derived state | [events.ts](../packages/core/src/events.ts) | Clients append events; the reducer computes XP, goals and completed IDs. |
| Web progress and auth context | [progress.tsx](../apps/web/src/lib/progress.tsx) | Components consume ready, progress, user and addEvents; they do not edit a database. |
| Web account-scoped persistence | [progress-storage.ts](../apps/web/src/lib/progress-storage.ts) | Existing auth and progress storage has special synchronization responsibilities. |
| Mobile persistence and sync | [storage.ts](../apps/mobile/src/lib/storage.ts), [sync-worker.ts](../apps/mobile/src/lib/sync-worker.ts) | SQLite stores an outbox; the worker owns auth adoption and sync behavior. |
| Public content endpoints | [routes/content.ts](../apps/api/src/routes/content.ts) | Files come from compiled content, not database rows. |
| Server progress validation | [sync-validation.ts](../apps/api/src/sync-validation.ts) | The server validates events and bounds client claims. |
| Authoring and compilation | [compile.ts](../packages/content/src/compile.ts), [validate.ts](../packages/content/src/validate.ts) | YAML is authored input; compiled JSON is generated output. |
| Shared visual tokens | [UI tokens](../packages/ui/src/index.ts), [web CSS](../apps/web/src/app/globals.css), [mobile theme](../apps/mobile/src/theme.tsx) | Reuse existing colors, spacing and buttons. |

### Rules that apply to every story

1. **Do not mutate UserProgress directly.** Most stories are read-only. US-21 uses the existing goal_set event through addEvents. Do not add a separate progress-write endpoint: /sync remains the write path.
2. **Do not change XP, grading, heart costs or unlock rules incidentally.** Presentation and local preferences are not achievements or progress events.
3. **Keep browser-only APIs in the web app and platform-free logic in core.** Never import React, localStorage, Node filesystem APIs or Expo packages into a core helper.
4. **Do not rename published content IDs.** Do not hand-edit generated course JSON or generated lesson YAML for a UI story. None of these stories requires regenerating the curriculum. US-25 reads it only.
5. **Do not clear unrelated browser storage.** New settings use their own documented keys. Favorites must be account-scoped. Do not call localStorage.clear or delete an outbox to reset a UI preference.
6. **Keep production credentials out of code and screenshots.** Use a local/test account. A downloaded progress report must exclude access tokens, refresh tokens and passwords.
7. **Make controls usable with a keyboard and at 320px width.** Give inputs labels, buttons a type when inside a form, and status changes meaningful text. Honor the existing light/dark palette and reduced-motion styling.
8. **Use small fixtures in tests.** Do not import the entire 11,397-lesson bundle to test a three-row filter or a percentage. Test an invariant or boundary, not a duplicate of the implementation.
9. **Keep changes reviewable.** A new preference does not justify a generic settings framework. A read-only API does not justify a new database table. Ask a teammate to review any scope expansion before doing it.

### Local setup: run once in a clean checkout

The shared workspace may already contain changes. First run git status --short. If it is dirty, use a clean checkout/branch with your teammate's help; do not reset, stash or overwrite another person's work just to follow this guide. Start from the current reviewed release branch or its merged successor, not an older training snapshot.

Use Node 24 and the repository's pinned pnpm via Corepack. In PowerShell, from the repository root:

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

Open the URL printed by Next.js, normally http://localhost:3000. Guest-only UI work does not require registering an account. For account/sync acceptance checks, configure a **test** PostgreSQL database and the server environment using [the Vercel/local setup guide](../docs/VERCEL.md). Do not substitute the production database. Restart the dev server after changing environment variables.

For mobile work, follow [the repository README](../README.md) to start the existing Expo app, then run corepack pnpm mobile:start. Configure apps/mobile/.env.example values for a reachable test API when account checks require one. A phone's localhost is the phone, not your laptop. UI-only checks can use the existing guest flow.

### How to verify a story

Each story names focused commands. Commands assume the repository root unless the text says otherwise. A web-only presentation change needs its listed manual checks and a type check; it does not need a new test framework. New pure logic needs small Vitest tests. The app currently has no general React component-test harness, so do not introduce one just to assert a button label.

After focused checks pass, use the existing release checks before requesting review:

~~~powershell
corepack pnpm release:check
~~~

This runs the production dependency audit and the Turbo test/typecheck graph; the graph also builds required dependencies. A full web packaging check is corepack pnpm --filter @aral/web build after prerequisite builds. API database integration checks need the test database described in the repo. The full [release workflow](../.github/workflows/release-check.yml) also covers containers, native exports and HTTP checks; confirm the workflow filename in the checkout if it has moved.

Windows security tests intentionally launch child processes with short time limits. If they time out while a heavy build is running, stop adding parallel work and rerun the affected checks after the build finishes. Do not relax security assertions to get a green result.

### Completion checklist for every story

- The story's acceptance criteria have been demonstrated with a guest, and with an account when the story uses account scope.
- New helper behavior has focused tests where requested; UI checks record actual steps and outcomes.
- Existing tests/type checks relevant to the changed packages pass.
- No unrelated content, lockfile, auth, sync or generated-output changes appear in the diff.
- The PR states the before/after behavior, changed files, verification and any deliberately excluded follow-up.
- The author can answer the story's teach-back question without reading the implementation aloud.

---

## US-01 — Remember course browser preferences on this device

**User story:** As a returning learner, I want the course browser to remember my selected track, unit filter and page so I can continue browsing without setting them again.

**Current gap and learning goal:** CourseMapPage keeps selectedTier in component state, while UnitList owns query, filter and page. These reset on a reload. Learn how local UI preferences differ from synchronized learning progress. Scope this to one browser; do not promise cross-device persistence or remember search text.

**Size and dependencies:** 4–6 hours; no prerequisite story. This is a browser-wide preference, like theme, and contains no completion data or account identifier.

**Read first:** [course page](../apps/web/src/app/page.tsx), especially CourseMapPage and UnitList; [discovery helpers](../packages/core/src/discovery.ts); [ThemeToggle](../apps/web/src/components/ThemeToggle.tsx) for guarded browser storage. Proposed new files: apps/web/src/lib/course-view.ts and course-view.test.ts beside it.

**Acceptance criteria**

- Reloading restores a valid track, all/unfinished/completed filter, and page number for that track.
- An unknown track, invalid filter, negative/fractional page or malformed JSON falls back safely.
- Pages are clamped when the filtered list shrinks. Changing the filter starts at page one.
- Starting a new track through placement immediately selects it and saves that choice.
- With storage unavailable, browsing still works for the current page lifetime. No progress event is emitted.

**Implementation plan**

1. Write down the existing ownership: selectedTier belongs to CourseMapPage; page/filter belong to UnitList. Keep that structure initially rather than moving everything into ProgressProvider.
2. Define a small version-1 stored shape: selectedTierId plus a byTier object containing filter and zero-based page. Use only a dedicated key such as aral.courseView.v1. Exclude the search query from the shape.
3. In the new library file, add a pure parser that accepts unknown data and known tier IDs. Accept only the three filter strings and finite nonnegative integer pages; cap implausibly large stored pages before the UI clamps them to its actual page count.
4. Wrap getItem, JSON.parse and setItem in guarded functions. Return defaults on a read failure. Do not log the whole storage value and do not reach into ProgressStorage's auth/outbox keys.
5. Read saved preferences after the client mounts. Keep a loaded flag so initial defaults are not written over saved settings before the read completes. Avoid localStorage reads during server rendering.
6. Pass the selected track's initial page/filter into UnitList and report user changes back through a small callback. Keep query ephemeral. Persist only deliberate user changes, not every render.
7. Use the existing activePage clamp when progress/filter changes reduce pageCount. Persist the clamped value when necessary, and have placement's onPlace callback replace the saved selected track.
8. Verify track A and track B can remember different pages, and that switching accounts never stores or displays another account's completion data through this preference object.

**Verification:** Unit-test valid settings, corrupt JSON, unknown IDs, page -1, page 1.5 and a removed track. Manually set page 3 in Foundations, switch tracks, reload and return. Block storage in a test browser and repeat without a crash. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** A storage effect that runs before hydration can erase the very setting being restored. Explain why this preference does not belong in a goal_set event or UserProgress.

---

## US-02 — Jump back to the current unit after browsing

**User story:** As a learner who has browsed far ahead, I want a Back to current unit button so I can quickly find the unit containing my next lesson.

**Current gap and learning goal:** UnitList initially opens the next unit's page, but after using paging or search there is no dedicated way back. Learn to derive a navigation action from currentUnitId and existing pagination without storing a second definition of the learner's next lesson.

**Size and dependencies:** 2–4 hours; independent of US-01. No persistence, API or core rule changes.

**Read first:** [course page](../apps/web/src/app/page.tsx), especially currentIndex, pageSize, filtered and activePage; [findNextLesson](../packages/core/src/discovery.ts). A new component is unnecessary unless the existing function becomes hard to read.

**Acceptance criteria**

- The button appears when the selected track contains currentUnitId.
- Clicking it clears query/completion filters, selects the correct unfiltered page and opens the current card.
- The destination stays within the selected track. The button is absent for a fully completed course or a track with no current unit.
- Keyboard users receive focus at the destination summary. Reduced-motion users are not forced through smooth scrolling.
- The action does not start a lesson or change XP/progress.

**Implementation plan**

1. Locate the passed currentUnitId rather than calling findNextLesson again inside each card.
2. Derive currentIndex using the original units array. The destination page is floor(currentIndex / pageSize); do not calculate it from a filtered list.
3. Place a type=button control beside the search/paging area. Use the exact label Back to current unit. Hide it when currentIndex is -1.
4. In its handler, clear query, set filter to all, and set the destination page. Set a one-use pendingFocusUnitId state value so focus runs after React renders the new page.
5. Give each summary a stable DOM ID derived from its unit ID, or keep a ref for the current summary. Use getElementById rather than building an unescaped CSS selector from an ID.
6. In an effect watching the pending focus and visible page, open that unit's details element, focus its summary and call scrollIntoView. Prefer immediate/auto scrolling for the first version; smooth animation is not required.
7. Clear pendingFocusUnitId after handling it. Do not run the effect on every progress clock tick, which would pull users away from their reading.
8. If US-01 has already merged, update the saved filter/page through its existing callback instead of writing directly to its storage key.

**Verification:** Browse to the last page, enter a query that hides the current unit, press the new button, and verify the card/keyboard focus. Repeat on the first page and after switching tracks. The first unit must not be mistaken for a missing index because zero is falsy. Run corepack pnpm --filter @aral/web typecheck; record these manual checks in the PR.

**Review trap / teach-back:** Explain why currentIndex must be calculated before filtering and why focusing immediately inside the click handler can target an element that has not rendered yet.

---

## US-03 — Share a phrasebook search as a link

**User story:** As a learner helping a friend, I want to copy a link to my phrasebook search so the same vocabulary results open on their device.

**Current gap and learning goal:** The phrasebook's query and first-letter filter currently live only in React state. Learn URL encoding, browser navigation and the separation between public search criteria and private learner state. This story shares search criteria, not the user's favorites or account.

**Size and dependencies:** 4–6 hours; no prerequisite. Do not change the existing course browser or add a general routing library.

**Read first:** [WordsPage](../apps/web/src/app/words/page.tsx), [search helpers](../packages/core/src/discovery.ts), [root layout](../apps/web/src/app/layout.tsx). Proposed new files: apps/web/src/lib/phrasebook-url.ts and phrasebook-url.test.ts.

**Acceptance criteria**

- A link such as /words?q=salamat&letter=S restores the query/filter after hydration and starts at results page one.
- Spaces, accented text and punctuation round-trip through URLSearchParams correctly.
- Invalid letters are ignored; oversized query input from a URL is bounded to a documented limit, such as 120 characters.
- Copy search link reports success only after clipboard writing succeeds; a selectable URL is shown if copying is unavailable.
- Reload and browser Back/Forward restore the URL's filters without a loop or leaking account data.

**Implementation plan**

1. Add pure parsePhrasebookSearch and buildPhrasebookSearch functions. Their inputs are URL search text and the current allowed letters. Their output is only query/letter state or URLSearchParams text.
2. Specify precedence: an explicit URL is authoritative for this page; defaults apply when parameters are absent. Do not combine this with US-01's course preferences.
3. Read window.location.search in a mount effect, and set query/letter/page together. Gate the initial URL-writing behavior until this read finishes so defaults do not erase an incoming link.
4. Add a popstate listener that repeats the parse/reset step, and remove the listener when the component unmounts. This small first version can use the browser History API without introducing a new useSearchParams/Suspense boundary.
5. Centralize filter changes in handlers that update React state and replace only the relevant query parameters with history.replaceState. Preserve unrelated parameters; clearing search removes q and letter instead of writing empty values.
6. Add Copy search link beside the result count. Build an absolute URL from the current origin and /words; never include auth data, hash fragments from an unrelated page, or storage contents.
7. Use navigator.clipboard.writeText inside the button handler. Await it before showing Copied. On absence or rejection, reveal a read-only input with the same URL and instructions to select/copy it manually.
8. Keep existing word pagination local; sharing a search should not fail because someone else has fewer results after a content update.

**Verification:** Test parser/serializer round trips for an accented phrase, spaces, invalid letters, repeated parameters and an empty search. Manually paste a copied link into a fresh private window and compare results. Test Back/Forward and denied clipboard permission. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Query strings are public. Explain why a user ID, token, favorite list or completion filter must never be added to this share link.

---

## US-04 — Expand or collapse the visible unit cards

**User story:** As a learner comparing units, I want to expand or collapse the cards on the current page with one action so I do not have to open each card individually.

**Current gap and learning goal:** Each unit already uses a native details/summary disclosure, but there is no batch action. Learn how to introduce deliberate disclosure state while preserving native keyboard behavior and the existing 12-card page limit.

**Size and dependencies:** 3–5 hours; no prerequisite. The action affects only the visible page, never all 2,850 units.

**Read first:** [UnitList and unit cards](../apps/web/src/app/page.tsx), [unit-card CSS](../apps/web/src/app/globals.css). US-02 is optional; if it already exists, its jump action should use the same open-card state.

**Acceptance criteria**

- Expand visible units opens all cards currently shown; Collapse visible units closes those cards.
- Individual summary controls still toggle with mouse, Enter and Space.
- Going to another page resets disclosure state to the normal current-unit behavior rather than retaining every previously opened card.
- Filtering to no results hides or disables the batch controls with a clear state.
- Batch actions do not expand unrendered pages, move keyboard focus unexpectedly or alter lesson access.

**Implementation plan**

1. Locate the existing open={isCurrent} behavior. Decide on one owner for open state rather than mixing direct DOM changes and competing state values.
2. Add an openedIds Set<string> to UnitList. Initialize the current unit as open when it is in the visible page. Keep a separate calculation for the page's visible IDs.
3. Synchronize an individual details element's onToggle event to the set. Compare the event's open state with the set before updating, and return the same state object when nothing changed to avoid a render/toggle loop.
4. Add two type=button controls above the page cards. The expand handler replaces the set with the visible IDs; the collapse handler removes those IDs. Neither handler changes page or filters.
5. On a real page/filter/track change, reset the open set to the current unit if present. Do not depend on a newly allocated array identity that changes on every render; derive a stable page key or stable joined ID list.
6. Keep native summary elements and their labels. Do not recreate them as clickable divs. Do not put the batch controls inside a summary.
7. If Back to current unit has been implemented, have it explicitly add the target ID after resetting the page. A user's later manual collapse should remain respected until another navigation action.
8. Check that completion updates and the 30-second clock refresh do not reopen cards the user just collapsed.

**Verification:** Expand 12 cards, collapse them, toggle one manually, change page, filter and switch tracks. Confirm only visible cards change. Test mouse and keyboard, and verify the next lesson's button still works. Run corepack pnpm --filter @aral/web typecheck. A component-test harness is not required for this presentation story.

**Review trap / teach-back:** Explain how a controlled open prop and the native toggle event can accidentally cause a state loop, and how your equality check prevents it.

---

## US-05 — Show a simple estimated lesson duration

**User story:** As a learner with a few spare minutes, I want an estimated lesson duration beside a lesson so I can decide whether to start now.

**Current gap and learning goal:** Lesson rows show a title and action, but no time estimate. Learn to put a small deterministic rule in core, expose it through the package barrel and render it without changing content or progress.

**Size and dependencies:** 3–5 hours; no prerequisite. This is an estimate, not measured personal speed, and not a promise of completion time.

**Read first:** [Lesson type](../packages/core/src/types.ts), [core exports](../packages/core/src/index.ts), [course page](../apps/web/src/app/page.tsx), [core test examples](../packages/core/src/discovery.test.ts). Proposed new files: packages/core/src/study-time.ts and study-time.test.ts.

**Acceptance criteria**

- A valid lesson with exercises displays About N min in the course row and continue hero.
- The documented initial rule is 30 seconds per exercise, rounded up to whole minutes; a nonempty lesson is at least one minute.
- Empty or invalid counts produce no displayed estimate rather than NaN, a negative number or a misleading zero-minute promise.
- The estimate is derived from the current lesson data and never written to YAML, UserProgress or a database.
- The action button remains readable at 320px width.

**Implementation plan**

1. Define estimateLessonMinutes(exerciseCount) returning number or null. Accept only finite positive integers; otherwise return null. For accepted counts, return ceil(exerciseCount * 30 / 60).
2. Add a comment explaining that the constant is a product estimate for the first version, not a statistically measured average. Keep it in this helper so a later adjustment has one home.
3. Export the helper from packages/core/src/index.ts. Import it from @aral/core in the web page instead of reaching into another package's src path.
4. Compute each row's estimate from lesson.exercises.length. Show it as secondary text below the lesson title, not as part of the Start button's accessible name.
5. Add the same wording to the hero using next.lesson. If next is null, do not display a duration on the course-complete card.
6. Use existing muted-text styling and allow the title/estimate block to wrap. Preserve the existing unlock checks and XP label.
7. If you later implement US-06, reuse this helper there; US-06 must not block completion of this story.

**Verification:** Test counts 1 => 1, 2 => 1, 3 => 2 and 8 => 4, plus zero, -1, NaN and 1.5 => null. Use a small fixture rather than the full course. Manually inspect a short hand-authored lesson and a generated lesson at phone width. Run corepack pnpm --filter @aral/core test, corepack pnpm --filter @aral/core typecheck and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Do not add a stored duration field to thousands of lessons for a value that can be derived. Explain why rounding up is more appropriate than rounding down for a time estimate.

---

## US-06 — Preview a lesson before starting

**User story:** As a learner choosing what to study, I want to preview a lesson's format and unit tip before starting so I know what to expect.

**Current gap and learning goal:** The course shows unit tips and lesson titles separately, while Start navigates straight into the player. Learn to compose a read-only component from existing content without accidentally mounting a gameplay session or revealing answers.

**Size and dependencies:** 4–6 hours; independent. US-05's duration helper may be reused if it already exists, but duration is not required for this story. Prefer an inline disclosure over a modal for the first version.

**Read first:** [UnitLessons](../apps/web/src/app/page.tsx), [content types](../packages/core/src/types.ts), [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx), [LessonPlayer](../apps/web/src/components/LessonPlayer.tsx). Proposed new file: apps/web/src/components/LessonPreview.tsx.

**Acceptance criteria**

- Each lesson row offers a separately labeled Preview control, including locked lessons.
- The preview shows title, exercise count, human-readable exercise formats and the unit's existing tip when present.
- It never shows answers, accepted-answer arrays, distractor correctness or listening transcripts.
- An unlocked lesson has the existing Start/Practice action; a locked lesson explains that earlier lessons or track placement are required.
- Opening/closing a preview does not create a session, spend a heart, earn XP or enqueue an event.

**Implementation plan**

1. Trace the boundary between a lesson row and the lesson route. The preview belongs in the course page; it must not reuse LessonPlayer, whose lifecycle records completions.
2. Create LessonPreview with explicit props: lesson, optional unitTip, locked and completed. Pass the already-derived lock/completion booleans from UnitLessons.
3. Map exercise.type values to labels: choice => Multiple choice, translate_taps => Translation, listen => Listening, match_pairs => Matching, fill_blank => Fill in the blank, arrange => Word order, dialogue => Conversation. Show unique formats in first-appearance order.
4. Render a native details/summary disclosure with an accessible label containing the lesson title, such as Preview Hello!. Place it outside any existing button/link and avoid nesting it inside the unit's summary.
5. Inside the disclosure, render only the approved metadata. Explicitly select fields rather than serializing an exercise object into the page.
6. Render the current lesson route link when unlocked. When locked, show a short explanation; do not create a special URL that bypasses the normal route guard.
7. Reuse existing card/tip styles and keep the unit's outer details behavior working. Multiple previews may remain open; no global modal state is needed.
8. Verify previewing a listening lesson does not call playAudio. Previewing a locked lesson should remain informational even if the user later opens its URL manually.

**Verification:** Manually preview a choice-only lesson, a mixed-format lesson, a lesson without a tip and a locked lesson. Inspect the browser's progress/outbox before and after opening/closing previews: it must be unchanged. Navigate using the approved Start link and confirm the real lesson still begins normally. Run corepack pnpm --filter @aral/web typecheck. If you extract a pure format-label helper, test repeated formats and an empty exercise list with a tiny fixture.

**Review trap / teach-back:** Explain why importing LessonPlayer for a convenient preview would cross a side-effect boundary, and identify the effect that makes it unsafe.

---

## US-07 — Add a discoverable lesson keyboard-help panel

**User story:** As a learner using a keyboard, I want to see the available lesson shortcuts so I can practice without guessing how the controls work.

**Current gap and learning goal:** Some shortcuts already work, including choice-number selection and Enter handling, but they are not explained in one place. Learn to document actual behavior in the product, inspect event handlers and avoid inventing shortcuts that are not implemented.

**Size and dependencies:** 2–4 hours; independent. This story adds a help panel, not a new shortcut system.

**Read first:** [LessonPlayer keyboard handler](../apps/web/src/components/LessonPlayer.tsx), [ChoiceView](../apps/web/src/components/exercises/ChoiceView.tsx), [FillBlankView](../apps/web/src/components/exercises/FillBlankView.tsx), [DialogueView](../apps/web/src/components/exercises/DialogueView.tsx). Proposed new file: apps/web/src/components/LessonKeyboardHelp.tsx.

**Acceptance criteria**

- A Keyboard help disclosure is available during an active lesson and is operable by keyboard.
- It explains Tab/Shift+Tab navigation, native Enter/Space button activation and the relevant existing shortcuts.
- Number-key guidance appears only for exercise formats whose current code supports it.
- The text explains that Enter in an editable field follows that field's behavior; it does not promise universal auto-submit.
- Opening help does not submit an answer, reset the current selection or change lesson state.

**Implementation plan**

1. Read each exercise view's keydown/onKeyDown handlers and make a small factual list of supported shortcuts. Distinguish global listeners from native button behavior.
2. Build a simple read-only component receiving the current exercise type. Keep its content in the component; a registry or keyboard library is unnecessary.
3. Use native details/summary so the help's expanded state and keyboard operation work without custom focus management. Give the summary the visible label Keyboard help.
4. Include universal guidance first: Tab moves between controls; Shift+Tab goes back; Enter or Space activates a focused button.
5. Add type-specific guidance only after verifying the handler. For choice exercises, explain that number keys select visible options and Check submits the selection.
6. Explain the player's Check/Continue behavior precisely. Do not bind a new question-mark or Escape listener as part of this story.
7. Place the panel below the lesson context and outside the exercise component's remount key. An exercise retry should not wipe the user's staged answer simply because they opened help.
8. Keep the control out of the completion-only view unless it still has useful content. Use existing muted text and readable spacing on phones.

**Verification:** Select an answer, open/close help, and confirm the answer remains selected. Test focus on a choice button and inside a text input; verify the panel's wording matches what Enter actually does. Test Tab order from Quit through Help into the exercise. Run corepack pnpm --filter @aral/web typecheck. No new core test or DOM-test dependency is needed for static instructional text.

**Review trap / teach-back:** Explain the difference between a document-level keyboard listener and the browser's native activation of a focused button, and why the help must account for both.

---

## US-08 — Confirm quitting an unfinished lesson

**User story:** As a learner, I want a chance to cancel an accidental tap on Quit so I do not lose my unfinished lesson session.

**Current gap and learning goal:** The player's Quit link immediately navigates to the course. Learn to model a small confirmation state without altering the session state machine or creating fake progress events.

**Size and dependencies:** 4–6 hours; independent. Scope the first version to the **explicit Quit control**. Browser Back, refresh, closing a tab and crash recovery are separate work; do not promise to intercept them.

**Read first:** [LessonPlayer](../apps/web/src/components/LessonPlayer.tsx), especially player-top, check, advance and completeMatch; [session state](../packages/core/src/session.ts); [lesson route](../apps/web/src/app/lesson/[lessonId]/page.tsx).

**Acceptance criteria**

- Quitting before any submitted answer returns directly to the course.
- After at least one submitted answer or completed matching grid, Quit asks whether to leave.
- Keep learning closes the confirmation and preserves the exact exercise/selection/feedback state.
- Leave lesson returns to the course without generating a completion or bonus event.
- Existing heart-loss events remain as they are. The message does not claim that quitting refunds hearts or saves an unfinished session.

**Implementation plan**

1. Add a hasInteracted flag in LessonPlayer. Set it when check actually submits an answer and when completeMatch processes a completed grid, including an incorrect first attempt. Merely selecting a choice or playing audio does not count for this version.
2. Add confirmingExit state. Replace the explicit Quit link with a type=button that either navigates immediately when hasInteracted is false or opens confirmation.
3. Use a small inline confirmation panel rather than claiming modal semantics without a focus trap. Label it Leave this lesson? and describe the actual outcome: unfinished answers will be lost; already recorded heart changes remain.
4. While the panel is open, hide or inert the exercise controls and suppress the player's global Enter handler so a confirmation keystroke cannot submit an answer underneath it.
5. Focus Keep learning when the panel opens. On cancel, restore focus to Quit or the previous valid control. Keep references local to the player and do not remount the session.
6. The Leave lesson action uses the existing course destination through the router. It must not call addEvents, reset the progress provider or send a compensating heart event.
7. Do not show this confirmation after session.done. The completion actions remain direct links.
8. Test a partial matching grid separately: unless you deliberately add an explicit interaction callback, document that the first version protects a completed matching submission, not every partially selected pair.

**Verification:** Quit an untouched lesson; quit/cancel after a wrong answer; cancel during feedback; confirm leaving; finish a lesson and use Back to course. Compare XP/completion before and after cancel/leave, and verify a recorded heart loss is not refunded. Run corepack pnpm --filter @aral/web typecheck and corepack pnpm --filter @aral/core test.

**Review trap / teach-back:** Explain why an exit confirmation must not call startSession again and why reversing already emitted heart events would be a product-rule change, not a navigation fix.

---

## US-09 — Show first-try accuracy in the lesson summary

**User story:** As a learner, I want to see how many exercises I solved without a mistake so I can understand what to review after finishing a lesson.

**Current gap and learning goal:** Completion displays XP, perfection, combos and rewards, but not a clearly defined accuracy metric. Learn to derive a metric from existing session state instead of adding a counter that can drift during retries.

**Size and dependencies:** 4–6 hours; independent. The value is local to the completed session; no event schema, server validation or stored progress fields change.

**Read first:** [SessionState and submitAnswer](../packages/core/src/session.ts), [session tests](../packages/core/src/session.test.ts), [LessonPlayer completion view](../apps/web/src/components/LessonPlayer.tsx). Proposed helper/tests can live in session.ts/session.test.ts or in a small new session-summary.ts file exported by core.

**Acceptance criteria**

- The metric is labeled First-try accuracy, with both a percentage and a count such as 3 of 4 exercises without a mistake.
- A retry of the same exercise does not enlarge the denominator or count the same missed exercise twice.
- A matching grid with any wrong pairing counts as one exercise with a mistake, not several failed exercises.
- Empty lessons produce no accuracy claim; a clean nonempty lesson shows 100%.
- XP, perfection, combo awards and review-queue behavior remain unchanged.

**Implementation plan**

1. Define the metric in a comment before implementing it: total is the number of distinct exercise IDs in the lesson; missed is the intersection of those IDs with session.missedExerciseIds; firstTryCorrect is total minus missed.
2. Add a pure helper returning total, firstTryCorrect and rounded percent, or null for a zero-exercise lesson. Using sets makes the intended uniqueness explicit and ignores stale/unrelated missed IDs in a test fixture.
3. Calculate percent as round(firstTryCorrect / total * 100). Do not use session.mistakes as the numerator because repeated wrong attempts and individual mismatches can make that value larger than the exercise count.
4. Write helper tests before UI wiring: four exercises with one unique miss => 75%; the same miss repeated => 75%; all missed => 0%; none missed => 100%; empty => null.
5. In session.done's completion branch, calculate the summary from the finished session and display it near the XP result. Do not calculate it from progress.weakExerciseIds, which may change after sync or review completion.
6. Use text that remains understandable without a colored progress bar. A bar is optional; the count and label are required.
7. Confirm practice and review sessions use the same formula. The metric reports that session's attempts, not historical mastery.
8. Keep the completion event payload identical; there is no new accuracy claim for the server to trust.

**Verification:** Run corepack pnpm --filter @aral/core test and corepack pnpm --filter @aral/web typecheck. Manually complete one lesson cleanly and another with the same wrong answer submitted twice. Confirm the latter counts one exercise with a mistake and the XP/review behavior is unchanged.

**Review trap / teach-back:** Explain why mistakes divided by attempts is a different metric and why it cannot be reconstructed from the current SessionState without a new attempt counter.

---

## US-10 — Clear an unfinished word-bank answer

**User story:** As a learner building a sentence, I want a Clear answer button so I can restart my word order without removing every word individually.

**Current gap and learning goal:** TapsView and ArrangeView allow removing individual picked tokens but have no clear-all control. Learn how a child exercise view updates both its local selection and the parent's staged answer.

**Size and dependencies:** 2–4 hours; independent. Web only for this first slice. No changes to grading or lesson events.

**Read first:** [TapsView](../apps/web/src/components/exercises/TapsView.tsx), [ArrangeView](../apps/web/src/components/exercises/ArrangeView.tsx), [LessonPlayer answer/Check state](../apps/web/src/components/LessonPlayer.tsx). Both views already have picked and an update helper.

**Acceptance criteria**

- Clear answer is enabled when at least one token is selected and the exercise is accepting input.
- Clearing returns every selected token to its bank and disables the parent's Check action.
- Repeated words remain individually usable; clearing must not merge equal-looking tokens.
- The control is disabled during feedback and does not reset the whole lesson, retry count, hearts or XP.
- Keyboard focus remains on a useful control after clearing.

**Implementation plan**

1. Trace update(next) in each view. It sets picked and calls onAnswerChange with null for an empty selection. Reuse this helper; calling setPicked([]) alone leaves the parent with a stale answer.
2. Add a type=button control immediately after the answer strip with label Clear answer. Set disabled to disabled || picked.length === 0.
3. The handler calls update([]). Do not use string matching to identify picked tokens; the existing indices intentionally support duplicate words.
4. Keep the individual token-removal buttons unchanged. This is an additional action, not a replacement.
5. Ensure the parent's answer becomes null and the Check button disables. The reset must not call submitAnswer or advance, which would change the session.
6. Test the disabled-state transition with keyboard focus. If the focused clear button becomes disabled, move focus to the first available word-bank button using a local ref; do not move focus to the page header.
7. Use existing button styles and allow the new action to fit beside or below a wrapping answer strip on narrow screens.
8. Repeat the same small change for ArrangeView. Avoid extracting a shared word-bank component in this ticket; that refactor would broaden the review considerably.

**Verification:** In translation, listening and arrange exercises, pick two words, clear, then rebuild a correct answer. Use a fixture or authored example with a repeated token and confirm both copies return. Submit an answer and verify Clear answer cannot modify feedback. Run corepack pnpm --filter @aral/web typecheck and corepack pnpm --filter @aral/core test. Record the manual interaction cases; no new test harness is necessary.

**Review trap / teach-back:** Explain how the child and parent can disagree if only picked is cleared, and point to the exact callback that prevents that stale-state bug.

---

## US-11 — Let learners turn automatic answer audio off

**User story:** As a learner studying quietly, I want to turn off automatic answer pronunciation while keeping the explicit Play buttons available.

**Current gap and learning goal:** LessonPlayer automatically calls playAudio after some correct answers. There is no separate preference for that automatic feedback. Learn to put a preference at the call site of a side effect, rather than globally disabling a capability the user may still need.

**Size and dependencies:** 4–6 hours; independent. Web only. Do not change browser volume or block audio needed to answer a listening exercise.

**Read first:** [LessonPlayer.check](../apps/web/src/components/LessonPlayer.tsx), [audio helper](../apps/web/src/lib/audio.ts), [TapsView listening controls](../apps/web/src/components/exercises/TapsView.tsx), [ThemeToggle storage pattern](../apps/web/src/components/ThemeToggle.tsx). Proposed new helper/test: apps/web/src/lib/answer-audio-preference.ts and answer-audio-preference.test.ts.

**Acceptance criteria**

- Automatic answer audio defaults to on, matching current behavior.
- A labeled toggle in the lesson controls changes automatic playback for subsequent answers and survives a reload on the same browser.
- Explicit pronunciation and listening Play buttons continue to work when the preference is off.
- Corrupt or unavailable storage falls back to the default and does not prevent answering a lesson.
- Toggling creates no progress event and changes no answer result or reward.

**Implementation plan**

1. Find the automatic playAudio call inside check and distinguish it from explicit buttons in child exercise views. Write this distinction in the preference's comment.
2. Define a boolean parser and dedicated storage key, for example aral.autoAnswerAudio.v1. Accept only a stored boolean; do not treat the string false as a truthy enabled value.
3. Read the setting after mount and expose it as local player state. Guard storage access. Persist changes from the toggle handler rather than an effect that could overwrite a saved value before it is loaded.
4. Add a button or checkbox with a visible label Automatic answer audio. If using a button, expose aria-pressed and render On/Off text instead of relying only on a speaker icon.
5. Gate only the automatic call with the preference. Leave the shared playAudio function and explicit playback callers unchanged.
6. Keep the toggle outside the keyed exercise subtree so a retry does not reset it. Ensure clicking it cannot trigger the player's Enter-to-check logic.
7. Apply changes to future playback only. Stopping an already playing clip and implementing global mute are deliberately outside this first version.
8. Verify the setting is browser-wide, like theme, and never added to the progress outbox. If another audio preference story has merged, preserve its separate key/fields.

**Verification:** Test the parser with true, false, undefined, a string and malformed JSON. In a browser, turn the setting off, answer correctly, use an explicit Play button, reload and repeat. Turn it back on and verify automatic playback resumes. Test a listening exercise while automatic audio is off. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why adding an early return to the shared playAudio function would be incorrect for this story, even though it appears to implement a mute switch quickly.

---

## US-12 — Choose a phrasebook text-to-speech speed

**User story:** As a beginner, I want slower generated pronunciation in the phrasebook so I can hear individual sounds more clearly.

**Current gap and learning goal:** Browser speech currently uses a fixed rate of 0.85. Learn to extend a function with an optional, validated parameter while preserving every existing caller's behavior.

**Size and dependencies:** 5–7 hours; independent of US-11. This story affects **phrasebook text-to-speech only**. Existing recordings retain their original playback speed, and lesson audio keeps its current default.

**Read first:** [web audio.ts](../apps/web/src/lib/audio.ts), [WordsPage and WordRow](../apps/web/src/app/words/page.tsx), [web API tests](../apps/web/src/lib/api.test.ts) for vi mock style. Proposed files: apps/web/src/lib/speech-rate.ts, speech-rate.test.ts and audio.test.ts if no audio test file exists yet.

**Acceptance criteria**

- Phrasebook offers Slow, Normal and Faster speech choices mapped to 0.7, 0.85 and 1.0.
- Normal is the default, and valid choices survive reload on the same browser.
- TTS utterances use the selected rate; recorded clips and other callers remain unchanged.
- An invalid, nonfinite or unsupported stored rate falls back to 0.85.
- Missing speech support still follows the existing unavailable-audio feedback path.

**Implementation plan**

1. Create a small pure normalizeSpeechRate helper that returns one of the three allowed values. Use exact membership, not arbitrary rates supplied from storage.
2. Extend playAudio with an optional third argument such as options containing speechRate. Keep its existing first two arguments and Promise<boolean> contract.
3. Thread the normalized rate into speak and assign it to the utterance's rate. The recording branch should not change Audio.playbackRate or skip its existing fallback behavior.
4. Verify calls without options continue to use 0.85. This backward-compatible default is the central regression boundary.
5. Add a labeled selector to WordsPage, load its dedicated preference after mount and guard storage writes. Label it Generated voice speed so users do not expect uploaded recordings to change.
6. Pass the current rate to WordRow and then into that row's explicit playAudio call. Do not copy speech logic into the row or search component.
7. Add a short explanation near the selector that the option applies to device-generated speech. Keep it meaningful to learners, without mentioning internal object names.
8. In tests, mock the Audio object and speechSynthesis/SpeechSynthesisUtterance at the module boundary. Trigger onend/onerror explicitly so promises do not hang while waiting for a real device voice. Restore globals after each test.

**Verification:** Test all three rates plus 0, 100, NaN and a string. Assert an old two-argument call still uses 0.85, a selected phrasebook rate reaches the utterance, recordings still attempt playback first, and playback failure preserves TTS fallback. Manually listen to one phrase at each rate on a supported device. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why changing a global speech default would affect lesson callers unintentionally, and why passing an optional argument makes the change easier to review.

---

## US-13 — Save favorite vocabulary on this device

**User story:** As a learner, I want to star useful words and view only my favorites so I can find them again quickly.

**Current gap and learning goal:** The phrasebook has search, letter filters and paging, but no personal saved list. Learn account-scoped persistence without changing the synchronized progress event model.

**Size and dependencies:** 1–2 days; independent. This is intentionally a **device-local** feature. No cloud synchronization, guest-to-account favorite merging or vocabulary progress tracking is included.

**Read first:** [WordsPage](../apps/web/src/app/words/page.tsx), [useProgress interface](../apps/web/src/lib/progress.tsx), [authScope/storage approach](../apps/web/src/lib/progress-storage.ts), [VocabEntry](../packages/core/src/types.ts). Proposed new files: apps/web/src/lib/favorites-storage.ts and favorites-storage.test.ts.

**Acceptance criteria**

- A star button adds/removes a vocabulary ID, announces its pressed state and has a label containing the word.
- A Favorites only filter combines with the existing search and letter filter and resets/clamps pagination correctly.
- Favorites survive reload. Guest, account A and account B cannot see one another's lists.
- Unknown/stale vocabulary IDs are ignored when displaying results. Corrupt/unavailable storage does not crash the phrasebook.
- The UI calls these On this device; no progress event, XP change or server request is created for starring a word.

**Implementation plan**

1. Use the progress context's ready and user values to identify a scope: guest or user:<user.id>. Do not use the email as a storage key and do not read tokens to find the user.
2. Define a dedicated versioned key per scope, such as aral.favorites.v1.<scope>. Store only a deduplicated string array of vocab IDs, with a documented cap of 500 favorites for this first version.
3. Build pure parsing/toggle helpers and a storage wrapper with injected Storage-like getItem/setItem methods. Validate unknown input and catch JSON/storage failures. Keep it separate from ProgressStorage so auth/outbox behavior is untouched.
4. In the UI, hold state together with the scope it belongs to. If the current scope differs from the loaded scope, render an empty/loading favorites state until the new list is read; never paint the previous account's stars for one render.
5. Load only after ready. Save in explicit toggle handlers, not an unconditional mount effect. This avoids overwriting a stored list with an initial empty array.
6. Give WordRow a favorite boolean and onToggle callback. Render a type=button star with aria-pressed and Add/Remove favorite wording. The row should not know about storage or authentication.
7. Apply Favorites only as a filter before the existing slice for the current page. Removing the last item on a page must use the existing activePage clamp rather than display an impossible page number.
8. Show a useful empty state: No favorites yet, with an explanation of the star. If 500 favorites are reached, preserve the current list and show a message instead of silently dropping an older item.
9. On logout/account switch, load the other scope; do not delete the old user's list. Guest favorites intentionally remain separate after login. A storage failure may keep the current in-memory list but must not claim it was saved permanently.

**Verification:** Test duplicate IDs, invalid JSON shapes, cap handling, a removed vocab ID and two separate scopes with a fake storage object. Manually star as guest, log in as A, star a different word, log out and verify the guest list returns. Test search+favorites+letter combinations and removal on the last page. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain the difference between a user-scoped UI collection and synchronized learning progress, and demonstrate the guard against briefly displaying account A's favorites after switching to B.

---

## US-14 — Copy a phrase and its English meaning

**User story:** As a learner, I want to copy a phrase with its translation so I can paste it into my personal study notes.

**Current gap and learning goal:** WordRow offers pronunciation but no copy action. Learn the success/failure lifecycle of an asynchronous browser capability, including a useful fallback.

**Size and dependencies:** 3–5 hours; independent of share links or favorites. Web only. Do not add a clipboard dependency.

**Read first:** [WordRow](../apps/web/src/app/words/page.tsx), [VocabEntry](../packages/core/src/types.ts), [existing web test patterns](../apps/web/src/lib/api.test.ts). Proposed helper/test: apps/web/src/lib/phrase-copy.ts and phrase-copy.test.ts.

**Acceptance criteria**

- Copy phrase copies exactly two lines: the Tagalog lemma, then its English translation.
- Notes, internal IDs, account data and audio URLs are excluded from the copied text.
- Copied is displayed only after a successful write. Rejection/unavailable clipboard support offers selectable text instead.
- Each row's feedback applies to that row and is announced without changing keyboard focus unnecessarily.
- Copying does not start playback, change search state or emit a progress event.

**Implementation plan**

1. Define a pure formatPhraseForCopy(entry) helper that returns lemma + newline + translation. Do not trim or normalize away meaningful accents and punctuation in the displayed content.
2. Add a type=button control with the visible label Copy and accessible label Copy phrase <lemma>. Keep it separate from the audio button.
3. In the click handler, reset old success/error feedback, check for navigator.clipboard?.writeText, and await the write of the formatted text.
4. Set the row's copied state only after the promise resolves. Do not optimistically claim success before the browser grants access.
5. If the API is unavailable or rejects, show a read-only textarea containing the same two lines and the instruction Select and copy this text. This avoids deprecated clipboard tricks and gives an explicit manual path.
6. Use a role=status message for success or failure. If you clear the message with a timer, keep a timer ref and clear it on unmount and before creating a new timer.
7. Ensure repeated clicks do not leave multiple timers fighting over the row's status. Keeping the button disabled while its request is pending is sufficient for the first version.
8. Check layout beside the audio button on a phone. You may place Copy below the translation rather than squeezing three controls into a narrow row.

**Verification:** Unit-test exact two-line formatting, accented characters and an entry with notes that must not be copied. Mock resolved, rejected and unavailable clipboard cases if the async helper is extracted. Manually paste into a plain-text editor and deny clipboard permission to exercise fallback. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why clipboard success must be awaited, and why formatting from selected fields is safer than JSON.stringify(entry).

---

## US-15 — Let learners hide phrasebook usage notes

**User story:** As a learner scanning familiar vocabulary, I want to hide usage notes temporarily so I can see more words without losing the notes when I need them.

**Current gap and learning goal:** Every entry with notes always renders them. Learn to separate display preferences from the underlying searchable data.

**Size and dependencies:** 2–4 hours; independent. Keep the preference browser-wide and local, like theme. Do not modify vocabulary content or its search index.

**Read first:** [WordsPage and WordRow](../apps/web/src/app/words/page.tsx), [searchVocab](../packages/core/src/discovery.ts), [ThemeToggle](../apps/web/src/components/ThemeToggle.tsx). A small preference helper is optional; do not build a settings provider for one boolean.

**Acceptance criteria**

- Show usage notes defaults to on and is a labeled checkbox or pressed-state button.
- Switching it off hides note paragraphs in the current results; switching it on restores them immediately.
- The choice survives reload when browser storage is available.
- Searching a term found only in a note still returns that word when notes are hidden.
- Words without notes remain unchanged, and toggling does not reset search, selected letter or page.

**Implementation plan**

1. Add showNotes state in WordsPage, defaulting to true. Use a dedicated key such as aral.phrasebook.showNotes.v1, separate from course preferences and favorites.
2. Read the stored boolean in an effect after mount. Catch storage and parsing failures and retain the default. If another story has introduced a suitable small preference helper, reuse it without changing its existing keys.
3. Add the labeled toggle near the phrasebook filters. Persist only changes initiated by that control, with guarded writes.
4. Pass showNotes to WordRow as a prop. Conditionally render the note paragraph when both showNotes and entry.notes are truthy.
5. Keep searchVocab's inputs unchanged. Do not delete notes, clone entries without notes, or filter them out before search merely to hide the paragraphs.
6. Add a short hint when notes are hidden: Search still includes usage notes. This explains why a word may match a term not currently visible in its row.
7. Do not store any new preference in the progress context or call addEvents. The feature should work entirely as a guest.
8. Inspect the existing result-count and pagination code to confirm neither is recomputed from whether note paragraphs are visible.

**Verification:** Find a vocabulary entry with a distinctive word in notes that is absent from its lemma/translation. Search for that word, toggle notes off and on, and verify the result remains. Reload with notes hidden and with storage blocked. Test a no-notes entry and phone/dark layouts. Run corepack pnpm --filter @aral/web typecheck. If you add a parser, include focused invalid-value tests and run corepack pnpm --filter @aral/web test.

**Review trap / teach-back:** Explain why changing presentation must not change search semantics, and identify which component owns the source data versus the display choice.

---

## US-16 — Show a deterministic word of the day

**User story:** As a learner building a daily habit, I want a word of the day so I have one small vocabulary item to return to each morning.

**Current gap and learning goal:** The phrasebook is a catalog rather than a daily prompt. Learn deterministic selection, explicit date inputs and the difference between stable product behavior and render-time randomness.

**Size and dependencies:** 4–6 hours; independent. Display-only; no reminder notifications, scheduling service, streak credit or XP reward.

**Read first:** [VocabEntry](../packages/core/src/types.ts), [localDayKey](../packages/core/src/streak.ts), [web useClock](../apps/web/src/lib/use-clock.ts), [WordsPage](../apps/web/src/app/words/page.tsx). Proposed files: packages/core/src/daily-word.ts and daily-word.test.ts; export the helper through core's index.ts.

**Acceptance criteria**

- The same vocabulary and local day key always select the same entry, including after reload.
- Reordering the vocabulary object's properties does not change that day's selection.
- Selection uses the full vocabulary, not the current search/letter/favorite filter.
- An empty vocabulary hides the card gracefully; a single-entry vocabulary always selects that entry.
- The card updates when the device's local day changes and creates no progress event. A content update may change the selection, which is acceptable for this first version.

**Implementation plan**

1. Define chooseDailyWord(entries, dayKey) as a pure function returning a VocabEntry or null. Take dayKey as an argument; do not call Date.now or inspect the device time zone inside core.
2. Sort a copy of entries by stable ID using a specified code-point ordering. Do not sort the shared input array in place or use a locale-dependent ordering for the daily index.
3. Use a small deterministic integer hash of dayKey and modulo the sorted entry count. A documented existing-style hash using Math.imul is enough; this is not a security or random-number service.
4. Handle zero entries before modulo. For a nonempty list, normalize the hash to an unsigned integer so the selected index cannot be negative.
5. In WordsPage, obtain now from useClock and compute today's key with localDayKey(now, deviceTz()). Memoize selection against the day key and full vocabulary.
6. Render a Word of the day card below the phrasebook introduction, showing the lemma and meaning and reusing the existing explicit pronunciation path. Keep search results and their counts independent of the card.
7. Do not emit a completion when the card is viewed or audio is played. Do not add a backend cron job; every client can derive the same result for its chosen local day.
8. If the user changes the search, confirm the card does not pick a new word merely because the shown array changes.

**Verification:** Test deterministic repeat calls, reversed input ordering, zero entries, one entry and selected IDs always belonging to the input. Use a test helper with an explicit day key to demonstrate a day change; do not rely on the wall clock. Manually simulate the next local day or inject a date during local testing and check the card updates without a reload. Run corepack pnpm --filter @aral/core test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why Math.random in a render or a hash over object iteration order would make the feature feel unreliable.

---

## US-17 — Practice a search result with reveal cards

**User story:** As a learner reviewing vocabulary, I want a small set of reveal cards from my search results so I can test recall without entering a full lesson.

**Current gap and learning goal:** The phrasebook displays both languages at once. Learn to build a deliberately small local state machine and distinguish self-study from assessed, synchronized lesson progress.

**Size and dependencies:** 5–7 hours; independent of favorites. Use the current filtered vocabulary, with at most 20 cards. This feature does not earn XP, spend hearts or modify the review queue.

**Read first:** [WordsPage filtered results](../apps/web/src/app/words/page.tsx), [VocabEntry](../packages/core/src/types.ts), [session.ts](../packages/core/src/session.ts) to understand why the real lesson engine is unnecessary here. Proposed new file: apps/web/src/components/VocabularyCards.tsx.

**Acceptance criteria**

- Practice these words is enabled when at least one filtered entry exists and starts a snapshot of up to 20 entries in the current deterministic result order.
- Each card initially shows only the Tagalog phrase; Reveal meaning shows its English translation.
- Next advances once, hides the next translation and displays the correct position, such as 2 of 5.
- The final card leads to a Finished screen with Start again and Close. The UI calls this self-study and does not imply XP rewards.
- Changing the search/filter closes the old deck, so a hidden set of old results is not mistaken for the new search.

**Implementation plan**

1. Add a start handler in WordsPage that takes shown.slice(0, 20) before page slicing. Copy the array so the deck's sequence remains stable while it is open.
2. Pass that snapshot into a small child component with onClose. Give it a key or explicit reset behavior tied to a newly started deck, not to each parent render.
3. Keep only index and revealed state in the component. Derive the current entry and finished condition from index and entries.length; do not duplicate the whole course session model.
4. Render the lemma in a heading and a Reveal meaning button. Do not render the translation in an aria-label, title or visually hidden element before reveal; that would spoil the exercise for assistive-technology users.
5. Show Next only after reveal. Its handler increments the index with a functional update and sets revealed to false. Disable duplicate clicks during a transition if needed, rather than skipping cards.
6. When index reaches the deck length, show the finished view without reading entries[index]. Start again resets index/revealed; Close unmounts the deck.
7. On any query, letter or optional Favorites only change, clear the active deck in the same handler. Preserve the phrasebook's current filters when the deck is closed normally.
8. Keep all state local. Do not invent a lesson ID, call startSession, or emit lesson_completed for this activity; the server only accepts authored lessons and the real review flow.

**Verification:** Use 0, 1, 2 and 25 matching entries; the last case must create 20 cards. Reveal, advance, restart and close; test changing search mid-deck and rapid Next clicks. Check focus and screen-reader text before reveal. Run corepack pnpm --filter @aral/web typecheck. If you extract a reducer for deck transitions, test start/reveal/next/end/reset with a two-card fixture and run the web test suite.

**Review trap / teach-back:** Explain why this self-study feature should not masquerade as a lesson completion just to reuse the existing XP animation.

---

## US-18 — Add a last-seven-days progress summary

**User story:** As a learner, I want a simple summary of my last seven calendar days so I can understand my consistency without interpreting every chart.

**Current gap and learning goal:** Stats already includes a 14-day XP chart and activity calendar, but no compact seven-day total/active-days summary. Learn calendar-safe aggregation and how to reuse derived progress rather than re-reading raw events.

**Size and dependencies:** 4–6 hours; independent. This is a rolling seven-day window including today, not an ISO week and not the last 168 hours.

**Read first:** [StatsPage date helpers and XpBars](../apps/web/src/app/stats/page.tsx), [xpByDay definition](../packages/core/src/events.ts), [localDayKey](../packages/core/src/streak.ts). Proposed new files: packages/core/src/weekly-summary.ts and weekly-summary.test.ts.

**Acceptance criteria**

- The summary reports total XP, active days out of seven, average XP per calendar day and the best day.
- Missing days count as zero. Future entries and entries older than the seven-day window are ignored.
- A day is active when its XP is greater than zero. Quest XP is included because xpByDay already includes it.
- Ties for best day choose the most recent tied day. With no XP, the UI says No active day yet instead of naming an arbitrary date.
- The calculation is correct across month/year changes and daylight-saving transitions.

**Implementation plan**

1. Define summarizeLastSevenDays(xpByDay, todayKey) as a pure helper. Its explicit todayKey comes from the page's existing local-day calculation.
2. Generate today and the preceding six YYYY-MM-DD keys using UTC calendar arithmetic on the day key, following the approach already used by dayKeyMinus in StatsPage. Do not subtract 24 hours from a local-midnight timestamp.
3. Read each day's XP from the map with a zero default. Decide to treat unexpected nonfinite/negative values as zero in the helper so test fixtures cannot produce NaN output.
4. Compute total, activeDays and round(total / 7) for average. Keep the denominator seven even when the learner was active for only one day.
5. Select the best positive-XP day, using the most recent key to break ties. Return null for bestDay when every day is zero.
6. Export the helper from core and render a small Last 7 days card near the existing chart. Keep the current 14-day visualization; this is an additional textual summary.
7. Format the best date with the existing calendar-safe display approach. Label the average as per day, not per active day.
8. Use the existing useClock-derived todayKey so a tab left open overnight refreshes correctly. No new event counter or storage field is necessary.

**Verification:** Test a window crossing January 1, February in a leap year, missing days, future values and best-day ties. For example, XP 10 on today and 20 two days ago yields total 30, activeDays 2 and average 4. Include a DST-week example with explicit day keys. Run corepack pnpm --filter @aral/core test, corepack pnpm --filter @aral/core typecheck and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why a seven-calendar-day summary should not use Date.now minus seven times 24 hours, and why summing dayStats.lessonXp would exclude some XP shown elsewhere.

---

## US-19 — Filter achievements by earned status

**User story:** As a learner, I want to see only earned or still-locked achievements so I can celebrate progress or choose my next target.

**Current gap and learning goal:** Achievements are already grouped by tier, but all of them render together. Learn to derive filtered lists while preserving a single source of truth for achievement eligibility.

**Size and dependencies:** 2–4 hours; independent. No new achievement criteria, persistent settings or progress writes.

**Read first:** [Achievements and AchievementCard](../apps/web/src/app/stats/page.tsx), [ACHIEVEMENTS and earnedAchievementIds](../packages/core/src/achievements.ts). The existing core function stays unchanged.

**Acceptance criteria**

- All, Earned and Locked controls are available; All is the default.
- The selected control exposes aria-pressed or equivalent native selection semantics.
- Filtering preserves the existing achievement definition order and tier grouping, hiding groups with no matching cards.
- The main earned/total summary continues to describe the full catalog, while any filtered count is labeled as matching results.
- A brand-new learner selecting Earned sees a helpful empty state and a way back to All.

**Implementation plan**

1. Add filter state inside the Achievements child component so it does not introduce a hook after StatsPage's early loading return. Import useState normally at the top of the file.
2. Render three type=button controls in a labeled group. Store one of the literal values all, earned or locked; do not store three booleans that can conflict.
3. Derive the visible definitions using the passed earned Set. Do not call a new achievement rule function or infer eligibility from card color/text.
4. Apply tier grouping to the filtered definitions. Return no group heading for a tier whose filtered list is empty.
5. Keep the page heading's earned.size / ACHIEVEMENTS.length unchanged. If you show a result count near the filter, explicitly label it matching achievements.
6. Render an empty message for zero matches. For Earned, invite the learner to complete a lesson; also offer Show all achievements to reset the filter without navigating away.
7. Do not persist the filter for this first version. A reload returning to All is acceptable and avoids unnecessary settings code.
8. Confirm newly earned achievements appear naturally when the passed earned Set updates, without manually appending cards to a second array.

**Verification:** Use a guest with no completions, then complete a lesson and revisit Stats. Check all three filters, stable ordering and hidden empty groups. Test keyboard activation and narrow/dark layout. Run corepack pnpm --filter @aral/web typecheck and corepack pnpm --filter @aral/core test to confirm eligibility rules are unaffected. A new test file is optional only if filtering is extracted into a genuinely reusable pure helper.

**Review trap / teach-back:** Explain why the selected filter is UI state but the visible achievement array should be derived rather than stored separately.

---

## US-20 — Add a 1,000-distinct-lessons milestone badge

**User story:** As a long-term learner, I want a milestone for completing 1,000 different lessons so the expanded course has a meaningful intermediate goal.

**Current gap and learning goal:** The shared achievement catalog has smaller lesson milestones and course completion, but no 1,000-distinct-lessons badge. Learn how shared pure rules automatically reach both platforms and how similar-looking counters can have different meanings.

**Size and dependencies:** 4–6 hours; independent. Use a plain English title such as A thousand steps unless a fluent reviewer supplies localized wording. The badge grants no additional XP.

**Read first:** [achievement definitions and criteria](../packages/core/src/achievements.ts), [achievement tests](../packages/core/src/achievements.test.ts), [UserProgress counters](../packages/core/src/events.ts), [web Stats](../apps/web/src/app/stats/page.tsx), [mobile Stats](../apps/mobile/app/stats.tsx).

**Acceptance criteria**

- A stable new ID, for example distinct_lessons_1000, appears in the long-haul tier with a clear title and description.
- The badge unlocks at 1,000 distinct completedLessonIds, not at 1,000 lesson_completed events or practice replays.
- Repeated IDs in a defensive test fixture cannot inflate eligibility.
- Learners who already qualify see the badge without replaying a lesson or migrating their account.
- Both platforms display it through the existing catalog; XP, streaks and event payloads remain unchanged.

**Implementation plan**

1. Read the comments on completedLessonIds and lessonsCompleted. The latter counts completions including practice, so it does not satisfy this story's distinct-lessons requirement.
2. Add one AchievementDef with a new stable ID, tier 3, an existing-style emoji and description Complete 1,000 different lessons. Keep every existing ID and threshold intact.
3. Add the matching criterion using the number of unique completedLessonIds. Count the recorded historical IDs; do not revoke the badge because a later content version removes an old lesson.
4. Add boundary fixtures for 999 and 1,000 unique IDs. A fixture can generate strings like lesson-0 through lesson-999; it does not need 1,000 full lesson objects.
5. Add a fixture with 1,000 total completion events represented by a large lessonsCompleted value but only two completedLessonIds; it must remain locked. Add duplicate-ID input as a separate guard.
6. Check the existing catalog/rule consistency tests and definition ordering. Put the new badge before course_complete so the terminal milestone remains last.
7. Inspect both Stats implementations and both completion views. They should already map shared definitions and derived earned IDs; only update a hardcoded assumption if you actually find one.
8. Demonstrate historical eligibility by rendering a fixture that already has 1,000 IDs. Do not introduce a badge-earned event, a migration or a claim endpoint.

**Verification:** Run corepack pnpm --filter @aral/core test, corepack pnpm --filter @aral/web typecheck and corepack pnpm --filter @aral/mobile typecheck. Use a test fixture or local development-only setup to inspect the locked and earned card on both platforms; do not manufacture production progress. Confirm the lesson completion's new-achievement display still derives its before/after difference normally.

**Review trap / teach-back:** Explain why lessonsCompleted and completedLessonIds are not interchangeable, and why a derived badge can appear for an existing user without storing a new event.

---

## US-21 — Allow a custom daily XP goal

**User story:** As a learner, I want to choose a daily XP goal between the preset buttons so I can set a target that fits my routine.

**Current gap and learning goal:** The web editor offers fixed presets, while the existing server goal_set validator accepts integer goals from 10 through 200. Learn to trace a UI input all the way to an existing event contract and validate before appending an event.

**Size and dependencies:** 5–7 hours; independent. This is the only story here that intentionally emits a progress event, and it reuses the existing goal_set event. No new endpoint, schema or migration is needed.

**Read first:** [GoalEditor](../apps/web/src/app/stats/page.tsx), [ProgressEvent and goal_set reducer](../packages/core/src/events.ts), [event schema bounds](../apps/api/src/sync-validation.ts), [addEvents](../apps/web/src/lib/progress.tsx). Proposed helper/test: apps/web/src/lib/goal-input.ts and goal-input.test.ts.

**Acceptance criteria**

- Existing presets remain available, plus a labeled custom field and Save goal button.
- Only whole-number text representing a value from 10 to 200 inclusive is accepted.
- Blank, decimal, exponent, nonnumeric and out-of-range input produces an inline error and no event.
- Saving the current goal again emits no duplicate event; a valid new value emits exactly one goal_set event.
- The UI updates immediately, persists through the existing offline outbox and synchronizes through /sync when an account is available.

**Implementation plan**

1. Confirm the current bounds in sync-validation.ts before touching the UI. Record 10..200 as this story's accepted contract; do not broaden the server validator to accommodate invalid client input.
2. Create parseGoalInput(text) returning either a validated number or a user-facing error. Trim the text, require one to three digits, then parse and check the inclusive range. Explicitly reject 10.5 and 1e2 rather than relying only on HTML input attributes.
3. Add a draft string state to GoalEditor, initialized from the current goal. Use a labeled text input with inputMode=numeric so the browser's number-input exponent handling does not become your validation rule.
4. Put the custom input and Save goal in a small form. Make preset buttons type=button so clicking a preset does not accidentally submit the custom form as well.
5. On submit, prevent default, parse the draft, display an associated inline error on failure and return before addEvents. Preserve the user's text so they can correct it.
6. If the parsed value equals the current goal, clear the error and report that the goal is already selected without adding another event. Otherwise reuse the existing newEventId, occurredAt and goal_set shape through addEvents.
7. Keep preset selection using the same setGoal path. When a preset is chosen, update the custom draft to that value and clear a previous error. Do not dispatch from both an input effect and the form handler.
8. Handle context updates deliberately: update the draft when the user is not editing; keep an actively edited draft until Save or a small Cancel/reset action. A 30-second clock refresh must not erase typed text.
9. Verify signed-out behavior uses the normal guest outbox and signed-in behavior uses the account's existing scope. Do not PATCH /me or directly write dailyGoalXp into storage.

**Verification:** Unit-test 10, 200 and 75 as valid; blank, 9, 201, -10, 10.5, 1e2 and letters as invalid. Manually save 75, reload, choose a preset and verify a duplicate save does not increase pending changes. With a test account, save while offline, reconnect and confirm the server value. Run corepack pnpm --filter @aral/web test, corepack pnpm --filter @aral/web typecheck and corepack pnpm --filter @aral/api test.

**Review trap / teach-back:** Explain the path from the input through addEvents, local storage, /sync validation and reduceEvents, and why changing only a React number would not persist the goal.

---

## US-22 — Download a personal progress summary

**User story:** As a learner, I want to download a readable summary of my progress so I can keep a personal record outside the app.

**Current gap and learning goal:** Stats displays progress but does not offer a download. Learn explicit serialization, browser file creation and the boundary between user-facing data and authentication/internal state.

**Size and dependencies:** 5–7 hours; independent. This is an informational JSON download, **not a restorable backup**. Importing data, transferring accounts and uploading the report are excluded.

**Read first:** [StatsPage](../apps/web/src/app/stats/page.tsx), [UserProgress](../packages/core/src/events.ts), [useProgress](../apps/web/src/lib/progress.tsx), [bundle metadata](../apps/web/src/lib/content.ts). Proposed helper/tests: apps/web/src/lib/progress-report.ts and progress-report.test.ts.

**Acceptance criteria**

- Download progress summary saves a JSON file for the currently active guest/account after progress is ready.
- The file has an explicit reportVersion, exportedAt, course ID/version, XP total, distinct completed lesson IDs, daily goal, streak summary and XP-by-day values.
- It excludes tokens, passwords, email, raw auth objects, outbox event IDs, internal database fields and unrelated storage keys.
- The UI states that recent offline work is included but may not be synced, and that the file cannot currently be imported.
- Download errors are visible; object URLs are released after use; the action does not change progress.

**Implementation plan**

1. Define a ReportV1 type containing only the fields listed above. Choose field names once and document them so the format is understandable without reading UserProgress's entire internal type.
2. Create a pure makeProgressReport(progress, courseMetadata, exportedAt) helper. Construct the object field by field; never serialize ProgressContextValue or use a spread of an auth/session object.
3. Pass exportedAt into the helper rather than calling Date.now inside it. Copy arrays/maps so sorting the report cannot mutate the live progress object. Deduplicate completed IDs and keep output ordering deterministic for tests.
4. In StatsPage, disable/hide the download control until ready. Read the current context only when the user clicks, so a previous account's snapshot is not retained in a ref across logout.
5. Serialize the report with JSON.stringify(report, null, 2), make an application/json Blob, and create a temporary object URL. Use a filename such as aral-progress-YYYY-MM-DD.json derived from the date, not the user's email.
6. Create/click/remove a temporary download anchor. Revoke the object URL after the browser has had an opportunity to consume it, and also clean it up on error/unmount if you keep it in a ref.
7. Show plain text explaining this is a personal summary rather than an importable backup. If pendingCount is greater than zero, say that the summary includes locally saved changes still awaiting sync.
8. Catch download errors and show a retryable message. Do not call syncNow as a required precondition; offline local progress is valid report input.
9. Review the serialized JSON itself with a test account. Searching for token names is an extra check, not a substitute for the explicit field allowlist.

**Verification:** Test exact top-level keys, deterministic date input, copied/deduplicated IDs and absence of token/email/outbox properties even when the supplied fixture has extra runtime fields. Download as guest, then as A, then log out and download again; each must reflect the current scope. Run corepack pnpm --filter @aral/web test and corepack pnpm --filter @aral/web typecheck.

**Review trap / teach-back:** Explain why JSON.stringify(useProgress()) or exporting every localStorage key would be dangerous and why a summary should not be advertised as a recovery backup.

---

## US-23 — Make mobile account actions reachable from the top

**User story:** As a mobile learner, I want account and sync actions near the top of the course screen so I do not have to scroll past hundreds of units to log in or out.

**Current gap and learning goal:** The mobile course screen places its login/logout control in FlatList's footer, after the unit list. It already exposes account and pending-sync information through context. Learn to improve a native screen by reusing that context rather than introducing another authentication implementation.

**Size and dependencies:** 4–6 hours; independent. No web changes, new native package or auth API changes. Do not change the sync worker's retention/logout rules.

**Read first:** [mobile CourseMapScreen](../apps/mobile/app/index.tsx), especially ListHeaderComponent and ListFooterComponent; [mobile progress context](../apps/mobile/src/lib/progress.tsx); [sync worker](../apps/mobile/src/lib/sync-worker.ts); [theme helpers](../apps/mobile/src/theme.tsx). Proposed new component: apps/mobile/src/components/AccountPanel.tsx.

**Acceptance criteria**

- A compact account panel appears before the unit list, reachable without scrolling through units.
- Guests have clear Log in and Create account actions. Signed-in users see their email and Log out.
- Pending changes and expired-session messages use existing pendingCount/needsRelogin values. An expired session offers Log in again.
- The old footer account control is removed so actions are not duplicated.
- Account switching preserves the existing outbox/archive behavior; long emails and large text remain usable on a narrow screen.

**Implementation plan**

1. Locate the current footer's navigation and logout handlers. Write down which context functions they call; these exact functions must remain the implementation behind the new controls.
2. Create AccountPanel as a small presentational component. Either pass user/status/action props from CourseMapScreen or consume useProgress inside it; choose one approach and avoid a second local copy of user state.
3. Place it in ListHeaderComponent near the guest/account status text. Keep FlatList virtualization and its data/renderItem unchanged.
4. For guests, render two clearly labeled Pressables that navigate to /login and /register. For accounts, show the current email and call the existing logout function.
5. Render needsRelogin before a generic pending message so the user knows what action is required. Do not infer online/offline state from pendingCount alone; a nonzero outbox can simply be syncing.
6. If adding a Retry sync button, call the existing syncNow and guard duplicate taps with a local busy flag. Do not implement token refresh or clear failed events inside the component.
7. Remove only the old account-related ListFooterComponent. Preserve any unrelated footer content if another contributor has added it since this guide was written.
8. Use accessibilityRole=button, meaningful labels and the existing theme's button styles. Let email text wrap or truncate accessibly without pushing Log out off-screen; keep touch targets at least 44 points high.
9. Test logout with pending changes and log back into the same test account. The UI must not bypass the worker or delete its archived progress merely because the control moved.

**Verification:** Test guest, signed-in, expired-session and pending-change states in the existing Expo app. Use a long test email and increased system text size. Confirm the panel remains near the top after searching/switching tracks and that there is no duplicate footer action. Run corepack pnpm --filter @aral/mobile typecheck and corepack pnpm --filter @aral/mobile test; the existing sync-worker tests should remain unchanged and pass.

**Review trap / teach-back:** Explain what FlatList's header and footer mean for a 900-unit track, and why moving a button should not require changes to token storage or logout semantics.

---

## US-24 — Provide a lightweight public course overview endpoint

**User story:** As a developer building a course picker, I want a small public overview response so I can display course and track counts without downloading every exercise.

**Current gap and learning goal:** The API serves a manifest, the full bundle and audio files. The manifest includes an audio map but not a compact course/track overview. Learn a read-only API slice: derive a projection from compiled content, validate its input and test routing without a live database.

**Size and dependencies:** 1–2 days; independent. This is an API-only first slice, not a frontend data-loading rewrite. No database table, auth requirement, user data, new dependency or modification to /sync.

**Read first:** [content routes](../apps/api/src/routes/content.ts), [catalog loader](../apps/api/src/catalog.ts), [API app construction](../apps/api/src/app.ts), [route test patterns](../apps/api/src/app.test.ts), [Vercel API adapter](../apps/web/src/pages/api/[[...path]].ts). Proposed files: apps/api/src/course-overview.ts, course-overview.test.ts and routes/content-overview.test.ts.

**Acceptance criteria**

- GET /content/courses/en-tl/overview returns courseId, version, title, totals and an ordered array of track summaries containing id/title/unitCount/lessonCount/exerciseCount.
- Totals contain unit, lesson, exercise and vocabulary counts. The response contains no exercise bodies, answers, audio map, user information or filesystem paths.
- Unknown course IDs return 404 before reading any file. Missing/invalid/mismatched compiled artifacts return a generic 503 response.
- The endpoint works without authentication and performs no database calls.
- Its current-course response is comfortably below 16 KB and uses a revalidating cache policy, since the same URL can refer to a new course version after deployment.

**Implementation plan**

1. Write a CourseOverview response type in the new API helper file. Use explicit properties rather than serializing the bundle and deleting large fields afterward.
2. Add a pure summarizeCourse function over the minimal validated content shape. Count with reductions and preserve declared tier order. Handle a flat course with an empty tiers array while still returning correct totals.
3. Add a loader that reads manifest.json under the configured content directory, validates the fixed en-tl course and versioned bundle filename, and then reads that exact bundle. Follow catalog.ts's manifest/bundle version consistency check. Never join the user-supplied courseId into a path.
4. Validate the fields actually needed for the projection using the already installed zod package. Separate the pure projection from filesystem reading so tiny fixtures can test counts without compiling the real course.
5. Treat expected file/JSON/validation problems as content unavailable. The route should return a short generic 503 body; do not put exception messages, absolute paths or raw source data in the response.
6. Register the new route beside the existing manifest route. Reject any courseId except en-tl first. Set Cache-Control to public, max-age=0, must-revalidate; do not mark an unversioned overview immutable.
7. Keep a successful overview projection cached in the route closure for that app instance, since deployed content is immutable for the process lifetime. Do not cache failures, so a missing development build can recover. Document that rebuilding content while a development API is running requires restarting it to refresh a successful cache.
8. Make the loader injectable through a small optional contentRoutes option, or use an equivalent existing test seam. Tests can create a bare Fastify instance and register the routes with a fixture loader; they should not initialize PostgreSQL to test a public projection.
9. Check the Vercel adapter's path handling: this new route should flow through the existing Fastify bridge at /api/content/courses/en-tl/overview. Do not add it to the large-static-file redirect allowlist.
10. Add an optional smoke assertion to scripts/vercel-smoke.mjs only after the focused API tests pass. Keep existing manifest/bundle response behavior unchanged.

**Verification:** With a two-track fixture, assert exact totals and ordering, omitted large fields and byte size. Test flat content, unknown course, missing file, malformed JSON and version mismatch. Assert an unknown ID never invokes the loader and a failed load can later retry successfully. Run corepack pnpm --filter @aral/api test, corepack pnpm --filter @aral/api typecheck and corepack pnpm --filter @aral/web typecheck. Manually request both standalone /content/.../overview and embedded /api/content/.../overview against test servers.

**Review trap / teach-back:** Explain why the public summary belongs to compiled content rather than the users table, why a successful projection can be cached per deployment, and why missing content should not become a detailed 500 error page.

---

## US-25 — Generate a deterministic content inventory report

**User story:** As a content editor, I want a readable inventory of tracks, exercise formats and audio coverage so I can see where the course needs more work before editing lessons.

**Current gap and learning goal:** Compilation prints a short totals line and warnings, but there is no reusable Markdown inventory. Learn to separate filesystem/CLI concerns from pure reporting logic, and to distinguish an audio reference from a recording that actually exists.

**Size and dependencies:** 1–2 days; independent of US-24. This tool only reads existing content. It must not generate lessons, modify YAML, change course versions or synthesize audio.

**Read first:** [compiler main and audio map](../packages/content/src/compile.ts), [content types](../packages/core/src/types.ts), [content package scripts](../packages/content/package.json), [validation test style](../packages/content/src/validate.test.ts), [generator README](../packages/content/generator/README.md). Proposed files: packages/content/src/inventory.ts, inventory.test.ts and inventory-cli.ts.

**Acceptance criteria**

- A new content package command prints Markdown with overall counts, per-track counts, counts for all seven exercise types and audio coverage categories.
- Audio coverage distinguishes existing recordings, missing recordings with usable TTS text, and missing recordings with no usable TTS text.
- A key in bundle.audio alone does not count as a recording: the compiler deliberately includes references whose files are missing.
- Repeated runs over identical inputs produce byte-identical output; no automatic timestamp or random ordering is included.
- Missing/invalid compiled input produces a useful stderr message and nonzero exit status. The tool leaves content sources and compiled files unchanged.

**Implementation plan**

1. Define a pure buildContentInventory(bundle, recordedFilenames) function. Pass a set of actual recording filenames into it; do not call filesystem APIs inside the counting logic.
2. Count units, lessons, vocabulary entries and exercises from the compiled structure. Initialize counts for choice, translate_taps, listen, match_pairs, fill_blank, arrange and dialogue, including zero-count formats.
3. Build per-track rows in declared tier order. For flat content, use an explicitly labeled Unassigned/flat row instead of discarding units that have no tier.
4. For each unique audio reference, look up its expected filename and check membership in recordedFilenames. If no recording exists, classify the reference by whether audioTexts contains nonempty spoken text. Null, missing and whitespace-only text do not provide a usable fallback.
5. Keep the three audio categories mutually exclusive so their sum equals the total reference count. A recorded clip with TTS text still belongs only to the recorded category.
6. Add a pure renderInventoryMarkdown function. Use fixed section/row ordering and escape pipe characters/newlines in authored titles so a title cannot break the Markdown table. Include course ID/version instead of a changing generation timestamp.
7. Write a thin CLI that resolves the content package directory from import.meta.url, reads the current manifest and its allowlisted versioned bundle, and enumerates packages/content/audio/en-tl. Enumerate within that known directory; do not open arbitrary paths from audio-map strings. A missing audio directory means no recordings, not a broken course.
8. Do not import compile.ts just to reuse a helper: it calls main at module load and would rebuild content as an unintended side effect. Read the already compiled JSON; tell the operator to run content:build first when it is absent.
9. Add a script such as inventory: tsx src/inventory-cli.ts in packages/content/package.json, using the already installed tsx dependency. The CLI writes only report text to stdout and actionable failures to stderr; normal report use does not overwrite files.
10. Document the command and optional shell redirection in the content README. If saving a report for review, choose an explicit new output file; do not overwrite authored files or commit generated dist bundles.

**Verification:** Use a tiny fixture with two tracks, several exercise types and three audio references: one existing recording, one text-only fallback and one with neither. Expect category counts 1/1/1. Test an empty/flat course, a title containing a pipe, zero-count exercise types and identical output across repeated runs. Run corepack pnpm --filter @aral/content test and corepack pnpm --filter @aral/content typecheck. After implementing the new command, run corepack pnpm --filter @aral/content inventory twice and compare output. Check git diff to confirm no YAML, bundle or version changes.

**Review trap / teach-back:** Explain why counting Object.keys(bundle.audio) as available recordings would produce a false coverage report, and why importing a CLI module with top-level main is different from importing a pure helper.

---

## Choosing a first PR and asking for review

If you feel stuck, shrink the first commit to a pure helper plus three boundary tests, or to one visible control with no persistence. Follow the rest of the story in subsequent commits on the same branch. Do not turn uncertainty into a speculative backend rewrite.

Use this PR outline after implementing a story:

~~~text
Story: US-XX — <title>
Problem: <what a learner/editor could not do before>
Behavior: <what the completed feature now does>
Scope: <platforms and deliberately excluded follow-ups>
Files: <the few files that matter and why they changed>
Validation: <commands and exact manual scenarios that passed>
Learning: <one paragraph answering the story's teach-back question>
~~~

The plans in this file are specifications for future work. Writing or reviewing this backlog does not mark any story implemented, tested or released.

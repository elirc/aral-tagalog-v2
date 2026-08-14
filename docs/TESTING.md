# Testing guide

What is tested, where the tests live, and — most importantly — *why each test
exists*. Many of these tests encode real bugs found during a July 2026 audit
of the codebase; those are called out inline so nobody "simplifies" away a
regression guard without knowing what it guards.

## Running

```sh
pnpm test                        # all packages via turbo
pnpm --filter @aral/core test    # one package
pnpm --filter @aral/api test
pnpm --filter @aral/content test
```

All suites are Vitest. `@aral/web` and `@aral/mobile` have no unit suites —
their logic lives in `@aral/core` by design (ARCH: game logic is pure TS in
core, UI apps are thin shells), so the highest-value tests sit below the UI.
The apps are gated by `pnpm typecheck` and `pnpm build`.

---

## packages/core — the game logic

Everything a lesson session, progress stream, or gamification rule can do is
pure and deterministic here, which is why this package carries the bulk of the
tests: a bug in core corrupts *both* clients and the server's derived state at
once.

### `grading.test.ts`

| Test | What / why |
| --- | --- |
| normalization (case, punctuation, accents) | `kumustá` must equal `kumusta` — learners shouldn't fail for diacritics their keyboard can't type. |
| `ng`/`nang` tolerance | Tagalog-specific: the `ngNang` grading flag exists because even native speakers conflate them; the test pins that it only applies when the flag is set. |
| hyphen tolerance | Reduplication (`araw-araw` vs `araw araw`) — same idea as above, flag-gated. |
| tap-word joining | `translate_taps` answers arrive as arrays; grading must join with spaces before normalizing. |
| accepted alternates | The `accept` list must pass; there is rarely exactly one right translation. |
| wrong answer returns the canonical answer | The "Correct answer:" UI on misses depends on this contract. |
| choice exactness, `gradePair` | `choice` grades against the single answer; `match_pairs` grades per authored pair, not per plausible translation. |

### `session.test.ts`

| Test | What / why |
| --- | --- |
| completes when all answered | The basic state-machine invariant (`done`, progress fraction). |
| re-queues wrong answers, counts mistakes | Duolingo-style retry loop: a wrong answer moves the exercise to the back of the queue; each wrong answer is one mistake (hearts cost derives from this). |
| match_pairs always advances | Match exercises complete unconditionally but still report mistakes — a design quirk worth pinning. |
| records each missed exercise once | **Review feature.** An exercise answered wrong 3× in one session is *one* weak exercise, not three — otherwise the review queue would fill with duplicates. |
| match_pairs missed only with wrong pairings | A clean match must not enter the review queue. |
| splits finished session into missed/mastered | `sessionReviewOutcome` is the single source for what a completion event reports; missed and mastered must partition the *solved* exercises. |
| abandoned session masters nothing | **Edge case found in design review:** "mastered" is computed as solved-and-not-missed. If it were all-not-missed, quitting a lesson after one exercise would incorrectly clear the rest from the review queue. |

### `events.test.ts`

The event-sourced progress reducer — the most safety-critical code in the
repo, since server and clients must derive identical state from the same
stream.

| Test | What / why |
| --- | --- |
| derives xp/completions/streak/hearts | The core fold works end-to-end. |
| order-independence | Offline batches arrive late and out of order; the reducer sorts internally. Without this, two devices could permanently disagree. |
| practice refills a heart, not first-time completion | The practice contract (GAM-03). |
| future timestamps clamped | Anti-cheat (OFF-05): setting the device clock forward must not mint streaks/XP from the future. |
| baseline overlay (modern + legacy) | Clients fold their unsynced outbox *on top of* a server baseline. The legacy test feeds a baseline missing newer fields, because a deployed server may lag the client's schema. |
| **corrupt baseline missing `completedLessonIds`/`streak`** | **Regression for a real bug:** the fallback chains read `.length`/`.count` without optional chaining and threw on a truncated/hand-edited localStorage baseline. |
| idempotency on duplicate id | The event id is the sync idempotency key (OFF-03); a client retry after a dropped response must count once. |
| equal-timestamp determinism | Ties break by id so the fold is deterministic for a *set* regardless of arrival order. |
| hostile `hearts_lost` clamp, junk `goal_set` rejection | The reducer runs on the server against client-supplied payloads; garbage must not corrupt state. |
| xpByDay across timezones, longestStreak survives reset | Day bucketing is tz-sensitive (GAM-02); the longest-streak high-water mark must not reset with the current streak. |
| `goal_set` last-write-wins | Goal changes are settings, not accumulations. |
| **weak-exercise queue: build, clear, count** | **Review feature.** Missed ids enter the queue oldest-first; mastered ids leave it and increment `mistakesCleared` (feeds the `Ayos!` achievement). |
| mastering a never-weak exercise counts nothing | Otherwise every ordinary perfect lesson would inflate `mistakesCleared`. |
| id in both missed and mastered stays weak | Hostile/buggy events must resolve to the *safe* reading (still needs review). |
| re-missing a cleared exercise re-queues it | The queue is a live signal, not a one-shot log. |
| weak queue survives baseline overlay | Cross-device: mistakes made on the phone must be reviewable on the web. |
| **perfect practice doesn't count toward `perfectLessons`** | **Regression for a real farming hole:** replaying an easy lesson perfectly used to increment the perfect-lesson counters feeding achievements. |
| **a replay is clamped to practice XP even when the event denies it** | **Regression for an exploit:** the server clamps XP *per event* but nothing capped repetition, so re-sending completions of one lesson with fresh UUIDs and `practice` omitted farmed unlimited XP. Deriving "already completed ⇒ replay" in the reducer closes it for clients and server at once. The companion test uses a *baseline* completion, because the overlay path must see prior completions too. |

### `streak.test.ts`

| Test | What / why |
| --- | --- |
| per-tz day keys (LA vs Manila) | The same instant is different calendar days in different zones; streaks roll at *local* midnight (GAM-02). |
| once-per-day increment, reset after gap, month boundary | Core streak semantics, including the classic off-by-one trap at month ends. |
| alive through yesterday, 0 when dead | Display rule: a streak "survives" until a full local day is missed. |
| **`isValidTimeZone` accepts real zones, rejects junk** | **Regression for a real bug:** the API stored any string as `tz`. |
| **`localDayKey` falls back to UTC on an invalid zone** | Same bug's blast radius: an invalid stored tz made every `/me` and `/sync` throw 500 *forever* for that user. Fallback also un-bricks accounts corrupted before validation existed. |

### `hearts.test.ts`

| Test | What / why |
| --- | --- |
| loss floors at 0 | No negative hearts from event replays. |
| regen per 4h interval, clamped at max | Hearts are *computed* from elapsed time (works offline, no server clock). |
| partial regen progress persists | Losing a heart mid-interval must not reset the regen timer — classic freemium-lives bug. |
| full vs partial refill | The `"full"` refill (ads) vs +1 (practice) contract. |
| backwards clock is a no-op | Anti-cheat: setting the clock back must not eat progress or grant hearts. |

### `level.test.ts`

| Test | What / why |
| --- | --- |
| documented thresholds + exact boundaries L2–L60 | The quadratic curve is *published* in UI copy; boundaries are where off-by-ones live. |
| monotonicity | More XP can never mean a lower level. |
| junk input (NaN/±Infinity/negative) → level 1 | XP comes from a client-writable store; the math must not propagate NaN into the UI. |
| huge-xp termination | **Hardening:** the drift-correction loops must terminate even for a hand-edited `1e400` baseline — this test is why the clamp to `MAX_SAFE_INTEGER` exists. |
| `levelProgress` splits | The level bar renders directly from these numbers. |

### `xp.test.ts`

| Test | What / why |
| --- | --- |
| authored xp + perfect bonus | Pins the award formula the completion screen shows. |
| default when a lesson has no xp | `xp: 0`/missing falls back to `DEFAULT_LESSON_XP` — content authors may omit it. |
| `PRACTICE_XP < DEFAULT_LESSON_XP` | **The anti-farming premise as an executable assertion:** if someone "tunes" practice XP above first-time XP, this fails and forces a deliberate decision. |

### `review.test.ts`

The review feature's course-side logic (closes SPEC open question OQ-02).

| Test | What / why |
| --- | --- |
| null when nothing to review | The course map hides the review banner off this. |
| builds in queue order with `PRACTICE_XP` | Oldest mistakes first — queue order, deliberately *not* course order. |
| **skips stale ids, null when all stale** | **Content-update safety:** a bundle update can delete exercises; stale weak ids must never wedge review or crash the player. |
| caps session size | A 200-mistake backlog must still produce a short, winnable session. |
| `isLessonUnlocked`: first lesson, gap blocking, cross-unit, unknown id | This function was duplicated (and could drift) in both clients; it moved to core precisely so one test suite covers both apps. Unknown ids return `false` — fail closed. |

### `achievements.test.ts`

| Test | What / why |
| --- | --- |
| unique ids + valid tiers | The catalog and criteria are separate maps keyed by id; a typo in either silently makes a badge unearnable. This meta-test catches that. |
| per-badge unlock thresholds (lessons, perfects, practice, streak, xp) | One test per rule family, at and just-below thresholds. |
| **mistakes-cleared badge at 10** | Review-feature badge (`Ayos!`), driven by `mistakesCleared`. |
| unit completion needs the *whole* unit; empty units never count | `some(unit → every(lesson done))` has two classic failure modes (partial unit, vacuous truth on empty units); both are pinned. |
| ids in definition order | Both clients render badges in catalog order; the maxed-out fixture also proves every badge is *reachable*. |
| tolerates legacy progress objects | Server baselines predating newer fields flow straight into this function. |

---

## apps/api — server validation & routing

The API has no test database; the suites deliberately cover the layers that
are *pure* (extracted for exactly this purpose) plus route behavior that
doesn't touch Postgres. DB-touching flows (auth rotation, sync inserts) are
exercised end-to-end by running the stack (`docker compose up -d`,
`pnpm api:dev`).

### `sync-validation.test.ts`

`sanitizeEvents` was extracted from the `/sync` route so this suite could
exist — it is the anti-cheat boundary between clients and the progress store.

| Group | What / why |
| --- | --- |
| batch handling | Valid events of all four types pass; an invalid event rejects *individually* (a poison event must not wedge a client's whole outbox — the route's documented contract); invalid events without a string id are dropped silently; non-UUID ids rejected (they'd break idempotency). |
| xp clamping | Client-asserted XP is clamped to the *authored* value (perfect and non-perfect caps differ); unknown lesson ids clamp to the catalog max instead of rejecting (bundle version skew must not lose a newer client's progress); **practice completions clamp to `PRACTICE_XP` even with no catalog** — the practice cap is policy, not content. |
| timestamps | Future `occurredAt` clamps to now (OFF-05); past timestamps untouched. |
| field bounds | missed/mastered arrays capped at 50 ids; `hearts_lost` count 1–20; `goal_set` 10–200 — every numeric bound tested at both edges because these are the DoS/garbage limits. |
| **timestamp poison-pill** | `occurredAt` was a bare `z.number()`, which accepts `1.5` and `1e30` — values the `bigint` column rejects on INSERT. Since `/sync` inserts the batch in one statement, one bad event 500'd the whole request, and clients only clear their outbox on a 200, so it retried forever. The test sweeps fractional/negative/oversized/`Infinity`/`NaN` and asserts a healthy sibling event still lands. |

### `app.test.ts`

Fastify `inject` tests — no sockets, no DB (postgres-js connects lazily).

| Test | What / why |
| --- | --- |
| `/health` 200 | Liveness contract for deploys. |
| unknown course manifest 404 | Course id allowlist. |
| bundle name traversal / off-allowlist → 400 | The bundle filename regex is the only thing between a URL and `readFileSync` — traversal attempts must die at 400. |
| audio traversal (encoded) 400, `.exe` 400, missing file 404 | Same property for the audio dir. Note: *raw* `../` is dot-segment-normalized away before routing (arrives as a different URL entirely → 404), so the encoded form is the one that actually exercises the allowlist — the test asserts the never-serves invariant for both. |

### `routes/auth.test.ts`

| Test | What / why |
| --- | --- |
| `tzSchema` accepts real IANA zones, rejects junk/empty/oversized | **Regression for the tz-500 bug:** an unvalidated `tz` string used to brick an account's `/me` and `/sync` permanently. This schema guards `register` and `PATCH /me`. |

---

## packages/content — course validation

### `validate.test.ts`

The compiler refuses to publish a course that fails these rules; the suite
tests the rules directly.

| Group | What / why |
| --- | --- |
| choice | Answer duplicated among distractors (including case-only and accent-only duplicates — comparison is *normalized*, since the learner sees two visually-identical buttons where one is "wrong"); duplicate distractors. |
| word-bank solvability | **The big one: an exercise whose bank cannot spell any accepted answer is unwinnable** — the learner loses hearts with no way through. Covers: missing word, word needed twice with one chip, rescue via an `accept` alternative, punctuation/case immunity, and the **multi-token chip regression** (`hyphens` flag makes the chip "Araw-araw" normalize to two tokens; the first validator version flagged a real, solvable course exercise as broken — the backtracking matcher and this test came out of that false positive). |
| match_pairs | Duplicate left or right values make two buttons visually identical while only one pairing grades correct — an authoring error the learner experiences as a random wrong answer. |
| fill_blank | With options, at least one must match an accepted answer (normalized); free-text mode is exempt. |
| validateCourse | Duplicate lesson/exercise/vocab ids each reported (vocab collisions used to be *silently last-wins* in the bundle build); exercise-level problems are prefixed with the exercise id so authors can find them. |

---

## `pnpm smoke` — end-to-end against a running stack

33 checks over real HTTP and real Postgres (`scripts/smoke.mjs`). This is the
only layer that exercises the DB-backed flows, so it carries the checks that
unit tests structurally cannot:

- **Registration → login → `/me` → `/sync`** round trip, and that `/me` and
  `/sync` derive identical progress.
- **XP clamping end to end**: authored value for a first completion, flat
  practice XP for a replay — including the exploit case where the client omits
  the `practice` flag entirely.
- **Poison batch**: a fractional `occurredAt` is rejected on its own while its
  healthy sibling in the same batch still lands (200, `accepted: 1`).
- **Review queue**: a missed exercise enters it, mastering clears it, and
  `mistakesCleared` increments.
- **Event idempotency**: the same event id twice counts once.
- **Refresh-token benign race**: replaying a just-rotated token returns 409 and
  the family **survives** (the new token still works). This guards a real
  regression — reuse detection originally revoked the family here, silently
  logging out anyone with two tabs open.
- **Logout** revokes the family; the token then 401s.

Not covered: revocation *after* the reuse grace window elapses, which needs a
60s wait or a `REFRESH_REUSE_GRACE_MS=0` run.

## What is deliberately not unit-tested

- **Route flows that need Postgres** (register/login/refresh rotation/sync
  inserts): covered by types + the running stack; a test-container setup is
  the natural next step if regressions appear here.
- **React components (web/mobile):** intentionally thin; their logic lives in
  core. The cost of a component-test harness currently outweighs what it
  would catch beyond `typecheck` + `next build`.
- **The compiled course itself:** `pnpm content:build` *is* the test — it
  runs `validateCourse` over all 18 units and fails the build on any problem.

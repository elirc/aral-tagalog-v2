# Reverse-Engineered Architecture Decision Records — Aral

Ten ADRs reconstructed from the codebase. Two sources of evidence are used
throughout: the code itself (files, patterns, schema), and the authors' own
paper trail — `SPEC.md` tags decisions with codes (`ARCH-02`, `DAT-02`,
`OFF-03`…) that recur as comments in the code (e.g. `packages/db/src/schema.ts:36`),
and `README.md` §"Deliberate simplifications vs. the spec" records where
implementation diverged from the spec on purpose. Where a decision is under
strain, the negative consequences cite concrete defects found in a
ten-reviewer audit of the current tree (July 2026).

Statuses: **Accepted** = working as intended. **Accepted, under strain** =
sound decision whose edges have accumulated real defects. **Accepted,
partially honored** = the rule exists but was broken somewhere.

Honorable mention that didn't make the ten: self-managed auth (jose JWTs +
argon2 + rotating hashed refresh tokens in `apps/api/src/routes/auth.ts` and
the `refresh_tokens` table) instead of an auth provider — consistent with the
near-zero-cost constraint, currently weakened by a fail-open dev-secret
fallback in `apps/api/src/env.ts`.

---

## ADR-001: pnpm + Turborepo monorepo with an apps/packages split

**Status:** Accepted.

**Context.** One solo developer ships three deployables — a Next.js web app, an
Expo mobile app, and a Fastify API — that must share game logic, a content
pipeline, a DB schema, and design tokens. The spec's first constraint
(`SPEC.md` CON-01) is "solo developer; minimize operational complexity."
Polyrepo coordination costs (versioning, publishing shared packages) are
unaffordable at this team size.

**Decision.** A single repository using pnpm workspaces for linking and
Turborepo for task orchestration. Deployables live in `apps/` (`api`, `web`,
`mobile`); everything shared lives in `packages/` (`core`, `content`, `db`,
`ui`, `config`). Build order is encoded in the task graph: `turbo.json`
gives `build`, `test`, and `typecheck` a `dependsOn: ["^build"]` edge, so
dependents build after dependencies. Cross-cutting version conflicts are
resolved centrally — the root `package.json` pins `@types/react` via a pnpm
override so Next and Expo agree on React types.

**Alternatives considered.** Polyrepo with published npm packages (rejected:
publish/version overhead for one person); Nx (heavier, more opinionated than
needed); yarn workspaces alone without a task runner (no caching, no task
graph); React Native Web to collapse web+mobile into one app (explicitly
rejected — see ADR-002).

**Consequences.**
- *Positive:* Atomic cross-cutting changes — the current uncommitted diff
  touches core, content, API, web, and mobile in one changeset. Turbo's
  content-hash caching makes repeated `pnpm build`/`pnpm test` cheap.
- *Negative:* The task graph has a hole: the `dev` task (`turbo.json:14-17`)
  lacks `dependsOn: ["^build"]`, so a fresh clone's `pnpm dev` fails until
  `pnpm content:build` is run manually — documented as tribal knowledge in
  `CLAUDE.md` instead of encoded in the graph. Workspace-wide constraints
  (the `@types/react` override) are global and blunt.

---

## ADR-002: Functional core, per-platform shells — all game logic in a pure `packages/core`, UI duplicated per platform

**Status:** Accepted, partially honored.

**Context.** Web and mobile must behave identically for grading, sessions,
hearts, streaks, XP, levels, achievements, and event reduction — divergence
here corrupts user progress. But React Native Web-style single-codebase UI
imposes styling and platform compromises the authors didn't want (`SPEC.md`
ARCH-02: "avoids React Native Web's styling compromises while keeping the
hard logic 100% shared").

**Decision.** `packages/core` is pure TypeScript with zero platform or
framework dependencies — no React, no fetch, no storage. It exports the
exercise engine, grading (`grading.ts`), the session state machine
(`session.ts`), hearts/streak/XP/level math, the achievements catalog, and
the progress reducer (`core/src/index.ts` re-exports ten modules). Time is
always an explicit parameter (`now: number`), never `Date.now()` inside core
— which is what makes it deterministic and testable. `packages/ui` shares
*design tokens only* (colors/spacing/radii); each app writes its own
components against core.

**Alternatives considered.** React Native Web (rejected per spec); shared
component library (rejected — "platform components live in apps",
`SPEC.md` §3); logic duplicated per app (rejected: the parity requirement).

**Consequences.**
- *Positive:* All 57 unit tests in the repo live against core and run in
  milliseconds with no mocks. An audit diff of both apps confirmed event
  emission and grading are byte-equivalent — the shared-logic goal is
  genuinely achieved where core is used.
- *Negative:* The boundary was drawn at "logic" but the lesson player's
  *orchestration* (phase machine, completion summary, hearts gating) was
  left in the apps, so `LessonPlayer.tsx` exists twice (~280 parallel lines
  in `apps/web/src/components/` and `apps/mobile/src/components/`) and has
  already drifted behaviorally: web computes its completion summary by
  projecting `reduceEvents([event], tz, now, progress)` before appending;
  mobile reads live provider state after the effect and visibly flickers.
  The fix that preserves the ADR is a shared `useLessonPlayer` hook, not
  shared JSX.

---

## ADR-003: Event-sourced progress with a single write path and derived state

**Status:** Accepted, under strain at scale.

**Context.** Offline-capable multi-device sync is mandatory (`SPEC.md` G-05).
State-shaped sync ("hearts = 3, streak = 12") forces conflict resolution;
merging *facts* ("lesson X completed at T") does not. The spec calls this
"event-sourced-lite" (DAT-02) and promises future features (stats,
leaderboards) "come cheap."

**Decision.** All user progress is an append-only stream of `ProgressEvent`s
(`lesson_completed`, `hearts_lost`, `hearts_refilled`, `goal_set`) in one
`progress_events` table (`packages/db/src/schema.ts:41-60` — the doc comment
says "one table instead of separate xp_events/lesson_completions/user_state").
`POST /sync` is the *only* write path (API-01; `apps/api/src/routes/sync.ts`);
there are no state-mutation endpoints, and `CLAUDE.md` forbids adding them.
State is derived on both sides by the same reducer, `reduceEvents`
(`packages/core/src/events.ts`), which the server runs per request
(`apps/api/src/progress.ts:6-13`) and clients run over baseline + outbox.
The README documents a simplification vs. the spec: the three planned tables
(`xp_events`, `lesson_completions`, `user_state`) were collapsed into one.

**Alternatives considered.** CRUD state endpoints with last-write-wins
(rejected: lossy under offline/multi-device); full CQRS with stored
projections (deferred — README: "a cache table can be added if `/me` ever
gets slow"); CRDTs (overkill for additive-counter semantics).

**Consequences.**
- *Positive:* Multi-device convergence by construction; replays are no-ops;
  the new stats/achievements/level features shipped with **zero** schema
  migrations — exactly the promised payoff. The audit confirmed two devices
  syncing concurrently cannot lose updates.
- *Negative:* There is no snapshot/compaction, so every `/sync` and `/me`
  re-reads and re-folds the user's *entire* stream — O(N) per request with
  N unbounded, and clients sync on a 1.5–2s debounce after every event. The
  reducer's building block for snapshots (the `initial` baseline parameter)
  already exists but is used only client-side. Also, derived state means
  the server must trust client-asserted facts (`xp`, `lessonId` validated
  for shape, not against the course bundle) — XP forging is possible.

---

## ADR-004: At-least-once outbox sync with client-generated UUID idempotency

**Status:** Accepted, under strain — the invariant is enforced in only one of three layers.

**Context.** Offline clients must persist progress locally and upload later
over unreliable networks (`SPEC.md` OFF-02/OFF-03). Retries are inevitable,
so delivery is at-least-once; something must make replays harmless.

**Decision.** Clients mint a UUID per event at creation time; the event id
*is* the idempotency key (`schema.ts:44` — "client-generated UUID
(idempotency key)"). Events queue in a local outbox — `localStorage` array
on web (`apps/web/src/lib/progress.tsx`), a SQLite table with
`INSERT OR IGNORE` on mobile (`apps/mobile/src/lib/storage.ts:42-53`) — and
a debounced worker flushes batches (≤500) to `/sync`. The server dedupes
with a composite primary key `(user_id, id)` (`schema.ts:57`) plus
`.onConflictDoNothing()` (`sync.ts:66`); the whole batch is one atomic
multi-row INSERT. The per-user composite PK also means one user's event ids
cannot collide with or block another's. The response returns server-derived
progress as the client's new baseline; clients render
`reduceEvents(outbox, tz, now, baseline)` for optimistic UI.

**Alternatives considered.** Server-assigned ids (impossible offline);
sequence numbers per device (needs device identity and gap handling);
exactly-once via client transactions (unachievable over HTTP);
state-snapshot upload with server merge (rejected per OFF-03).

**Consequences.**
- *Positive:* Server-side idempotency is airtight — verified: re-POSTing any
  batch cannot duplicate rows, and batches are atomic.
- *Negative:* The audit found the invariant enforced only at the DB. (1)
  `reduceEvents` itself never dedupes by id, despite its doc comment — a
  client outbox containing a retried duplicate double-counts XP locally.
  (2) Web's `newEventId()` fallback emits non-UUIDs when
  `crypto.randomUUID` is absent (any plain-HTTP origin), which the server's
  `z.string().uuid()` rejects — and since one invalid event 400s the whole
  batch and clients retry the same batch forever, a single bad id
  permanently wedges sync (a poison-message failure with no dead-letter
  path). (3) Web clears the *entire* outbox on success instead of only the
  sent ids (mobile does it correctly), silently dropping events appended
  mid-flight. The decision is right; the web implementation broke two of
  its load-bearing details.

---

## ADR-005: Trust device wall-clock time, bucket days in the user's IANA timezone

**Status:** Accepted, with a known convergence gap.

**Context.** Streaks and daily-goal math need "did the user practice *today*"
— a local-calendar question. Offline completions must count for the day they
happened, not the day they synced (`SPEC.md` GAM-02: streaks use "the
completion timestamp recorded on device, not sync time").

**Decision.** Every event carries `occurredAt` = device epoch ms
(`schema.ts:52-53`). Day bucketing uses `localDayKey` built on
`Intl.DateTimeFormat` with an explicit IANA zone
(`packages/core/src/streak.ts` — deliberately DST-safe; day *arithmetic* is
done in UTC-day numbers, not `± 86_400_000`). The server stores a per-user
`tz` column (`schema.ts:20`, default UTC) and reduces with it; clients
reduce with the live device zone. Clock tampering is mitigated server-side
by clamping future timestamps to server-now at insert (`sync.ts:62-63`,
per OFF-05); hearts regeneration is computed purely from timestamps so it
works offline.

**Alternatives considered.** Server-receipt time (rejected: breaks offline
streaks); UTC-only days (rejected: midnight rollover is wrong for most of
the world); sending tz per event (more truthful for travelers, more payload
and complexity).

**Consequences.**
- *Positive:* Offline streaks work; DST transitions are handled correctly in
  core (audited); cheating by future-dating is clamped.
- *Negative:* Distributed-time gaps found in audit: neither client ever
  calls the existing `PATCH /me` to update `tz`, so a user who registers in
  one zone and plays in another gets a *different* day bucketing on server
  vs. client — the sync response baseline then visibly resets the goal ring
  or breaks the streak. Ties in `occurredAt` reduce nondeterministically
  (stable sort + no SQL `ORDER BY` in `progress.ts:7-11`), so equal-timestamp
  `goal_set` events can flip winner between requests; the fix is a
  deterministic `(occurredAt, id)` tie-break in both layers. Backdating
  (past timestamps) is unbounded — accepted for a single-player v1, a real
  integrity issue the moment leaderboards land.

---

## ADR-006: Content as code — YAML compiled to an immutable, versioned bundle; no content tables in the DB

**Status:** Accepted.

**Context.** The author writes all course content (CON-03) and must be able
to play lessons fully offline (OFF-01) at near-zero hosting cost (CON-02).
Content changes far more often than schema and needs review like code.

**Decision.** Course content is YAML under `packages/content/course/en-tl/`
(course, vocab, `units/*.yaml` auto-discovered by `readdirSync().sort()` in
`compile.ts:136` — adding unit 06 requires no registration). A build step
validates with strict Zod schemas (`packages/content/src/schema.ts` —
including Tagalog-specific grading flags like `ng`/`nang` and hyphen
tolerance, CNT-04) and emits an immutable versioned JSON bundle + audio
manifest into `dist/` (gitignored). The README records the deliberate
simplification vs. spec: **no content tables in Postgres** — the API serves
bundles straight from disk; the DB holds only users and progress events. Web
imports the bundle at build time; mobile ships it in the binary and
hot-swaps newer downloaded versions (OFF-04). `course.yaml` carries a
`version` that must be bumped on content edits (enforced by convention in
`CLAUDE.md`; currently bumped 1→2 in the working tree). Audio is
pre-generated at build time (self-recorded or local Piper TTS, AUD-01/02),
never runtime TTS (AUD-04).

**Alternatives considered.** Content in Postgres with an admin UI (rejected:
operational weight, and clients would need online queries); a headless CMS
(cost, lock-in); runtime TTS (rejected per AUD-04: inconsistent Tagalog
support); mutable bundles (would break client caching assumptions).

**Consequences.**
- *Positive:* Content is diffable, reviewable, and validated pre-deploy — the
  audit's content build compiled 10 units/301 exercises clean, and schema
  violations are impossible to ship. Offline play works with the API down.
- *Negative:* The bundle export is an untyped gitignored artifact
  (`"./bundle": "./dist/course_en_tl.json"`), so both apps cast
  (`as unknown as CourseBundle`) and a stale `dist/` is invisible to the
  type system; plus the ADR-001 dev-task footgun. The compiler's audio-text
  registry has a first-write-wins bug (choice-exercise *English* answers
  claim Tagalog audio refs before vocab lemmas register), which would
  poison any TTS run — a pipeline defect, not a decision defect. Content
  correctness itself has no native-speaker gate (the audit found one
  ungrammatical drilled sentence).

---

## ADR-007: Data access via Drizzle ORM on Postgres, with a schema-on-read `jsonb` event payload

**Status:** Accepted.

**Context.** The API needs typed, migration-managed persistence deployable on
free-tier Postgres (Neon/Supabase per `SPEC.md` §10) by one person. Event
shapes evolve (four types today, more coming — streak freezes, etc.);
migrating a column-per-field table on every new event type would negate the
event-sourcing payoff (ADR-003).

**Decision.** Drizzle ORM with `drizzle-kit` migrations (`packages/db`,
`pnpm db:migrate`). The event row stores promoted columns only for what the
DB itself needs — identity `(user_id, id)`, `type`, `occurred_at` (indexed
with `user_id` for time-range reads, `schema.ts:58`), `synced_at` — and the
full event as a `jsonb payload` (`schema.ts:51`), deserialized and
interpreted exclusively by the shared reducer. Validation happens at the API
boundary with Zod (see ADR-008), not with DB constraints; `SPEC.md` DAT-01
states the philosophy: "Zod validates…so DB stays schema-light."

**Alternatives considered.** Prisma (heavier runtime/codegen); raw SQL (no
typed migrations); one table per event type (the spec's original three-table
design, consciously collapsed — README); MongoDB (jsonb gives the
flexibility without leaving Postgres); SQLite server-side (no managed
free-tier hosting story).

**Consequences.**
- *Positive:* New event types and fields need no migration — the entire
  achievements/level/goal feature set landed with zero DDL. Queries are
  parameterized throughout (audit: no injection anywhere). The composite PK
  doubles as the idempotency mechanism (ADR-004).
- *Negative:* Schema-on-read concentrates trust in the reducer: the DB will
  happily store any validated-shape payload, and the read path
  (`progress.ts:7-11`) has no `ORDER BY`, delegating ordering to a reducer
  sort that lacks a tie-break (ADR-005). `payload` is cast, not parsed, on
  read (`as ProgressEvent[]`, `sync.ts:52`) — drift between the Zod schema
  and the TS type is invisible. The untargeted `.onConflictDoNothing()`
  would also silently swallow *future* constraint violations, not just PK
  replays.

---

## ADR-008: API contract — Fastify + Zod boundary validation; one batch endpoint with all-or-nothing semantics; validate shape, trust meaning

**Status:** Accepted, under strain — the all-or-nothing choice interacts badly with ADR-004's retry loop.

**Context.** The API surface is deliberately tiny (`SPEC.md` §9: auth,
content, `/sync`, `/me`). With clients deriving state locally, the server's
contract job is to accept event batches safely and return derived truth.
Solo-dev constraint favors "fast, typed, minimal" (spec's words for
Fastify + Zod).

**Decision.** Fastify with a discriminated-union Zod schema per event type
(`sync.ts:8-37`) that is *stricter than the reducer* — UUID ids, `xp` capped
0–100, `goalXp` 10–200, `count` 1–20, batch `.max(500)` — and strips unknown
keys, so nothing unvalidated reaches the `jsonb` column. Any invalid event
rejects the **entire batch** with a 400 (`sync.ts:48-49`). Semantic
validation is deliberately absent: `lessonId` is "string ≤ 100 chars," not
"exists in the course bundle," and `xp` is not checked against the lesson's
authored value — the server validates shape and trusts meaning. Responses
return `{ accepted, progress }`, making the reduced state the authoritative
contract artifact rather than the events themselves.

**Alternatives considered.** Per-event accept/reject with a
`{acceptedIds, rejectedIds}` response (more robust, slightly more client
logic — the audit's unanimous recommendation); tRPC/GraphQL (unneeded for
five routes and a non-TS-client future was never a goal); server-computed
XP from the bundle (~20 lines, deferred — the API already loads content
from `env.contentDir`).

**Consequences.**
- *Positive:* The write path is a single, small, strictly-typed surface —
  the security audit found no injection and no cross-user access; the
  `(user_id, …)` scoping is applied on every query.
- *Negative:* All-or-nothing 400 + clients that retry the identical batch
  forever = the poison-outbox failure mode (ADR-004). The strictness itself
  creates contract triplication: `ProgressEvent` is defined independently in
  core (TS types), the API (Zod), and constrained differently by the content
  schema — a lesson authored with `xp ≥ 96` plus core's +5 perfect bonus
  produces an event the API rejects, i.e. the three definitions can disagree
  in ways no build step catches. Consolidating to one Zod source of truth in
  core (deriving the TS type via `z.infer`) is the structural fix. And
  `accepted: events.length` overcounts replays.

---

## ADR-009: Error-handling philosophy — validate loudly at the boundary, fail silently at the edges, keep the UI optimistic

**Status:** Accepted, under strain — silence hides real failures.

**Context.** An offline-first learning app must never block play on network
health: guest mode works with no backend at all (README: "fully playable
without an account or backend"), and sync is a background concern. The
authors chose where errors are *loud* (API input boundary, content build)
and where they are *quiet* (everything user-facing at runtime).

**Decision.** Three tiers, consistently applied. (1) **Boundary: strict and
loud** — Zod 400s at the API (ADR-008), Zod build failures in the content
compiler. (2) **Sync: optimistic with deferred reconciliation** — clients
apply events locally first, render `reduceEvents(outbox, …, baseline)`, and
swallow every sync error (`.catch(() => {})` in both providers;
`apps/mobile/src/lib/progress.tsx:79` comments "offline — outbox stays for
the next attempt"), trusting the outbox to deliver later. (3) **Media:
non-fatal by design** — missing audio plays nothing
(`apps/web/src/lib/audio.ts:11`: "clip missing or autoplay blocked —
non-fatal (AUD-02 fills gaps later)").

**Alternatives considered.** Error banners/toasts on sync failure (rejected
implicitly — no error UI exists anywhere); blocking writes until synced
(contradicts offline-first); retry with backoff + dead-letter queue (not
built); failing lessons when audio is missing (rejected — content shipped
before audio existed, by explicit README note).

**Consequences.**
- *Positive:* The app is genuinely resilient to a dead API — audited: guest
  play, lesson flow, and local persistence all work with the server down.
  No error spam during normal offline use.
- *Negative:* Silence is indistinguishable from success. The audit found:
  an expired refresh token leaves users "logged in" but never syncing
  again, with no indicator and an unboundedly growing outbox; the
  poison-batch wedge (ADR-004/008) is invisible for the same reason; and
  silent audio failure makes the 38 `listen` exercises *unanswerable* while
  still charging hearts — the one place tier-3 silence directly harms
  gameplay. The philosophy needs one amendment: distinguish *transient*
  errors (stay silent, retry) from *permanent* ones (auth-dead, 400-poison,
  missing media), which must surface or self-heal.

---

## ADR-010: Testing strategy — concentrate all tests on the pure core; leave shells and API untested

**Status:** Accepted, under strain — the defect map inverted the bet.

**Context.** Solo developer, limited time. `SPEC.md` §10 states the bet
verbatim: "Core logic is where tests pay off" (Vitest for core and api;
Maestro mobile E2E "later"). ADR-002's pure core makes unit testing cheap
and deterministic — explicit `now` parameters, no mocks, no I/O.

**Decision.** Vitest suites live exclusively in `packages/core/src/*.test.ts`:
57 tests across 7 files (events 13, achievements 13, level 10, grading 8,
hearts 5, streak 5, session 3), covering order-independence, timestamp
clamping, baseline overlay, timezone day-keys, and level boundaries to
level 60. Turbo wires `test` after `^build`. There are **zero** tests in
`apps/api` (no test script, no vitest dependency), none in either app, and
no E2E. The content compiler acts as the content test suite (schema
validation at build).

**Alternatives considered.** API integration tests with a test Postgres
(planned per spec, never built); React Testing Library for the players
(skipped); E2E (explicitly deferred); property-based testing for reducer
invariants (absent — and a natural fit).

**Consequences.**
- *Positive:* The tested surface is genuinely solid — the audit ran the
  suite green and found core's date/DST math, level curve, and achievement
  idempotency correct. Tests are fast enough to run on every change.
- *Negative:* The audit's severity map is almost a photographic negative of
  the coverage map: every HIGH-severity defect lives in untested layers —
  the web outbox lifecycle (wipe race, non-UUID fallback), the sync route's
  all-or-nothing semantics, auth-refresh limbo — while tested core yielded
  only MEDIUMs (missing id-dedup, `levelForXp(Infinity)` hang, both
  *outside* existing test cases). The strategy's stated scope ("core, api")
  was half-implemented: the api half never happened. Highest-leverage
  additions, per the audit: a reducer permutation+duplication property
  test, a split-stream convergence test (the baseline-overlay contract
  every client depends on), an emit-side schema round-trip test (would have
  caught the UUID fallback), and `app.inject`-based `/sync` tests.

---
---

# Interview translation

Ninety-second spoken framings, one per ADR, plus the follow-up you should
expect. First person, as the author of the system.

### ADR-001 — Monorepo

> "I had three deployables — web, mobile, API — and one developer: me. The
> expensive thing in that setup isn't code, it's coordination, so I put
> everything in one pnpm workspace with Turborepo doing task orchestration.
> The layering rule is simple: `apps/` is anything that deploys, `packages/`
> is anything shared — game engine, content compiler, DB schema, design
> tokens. Turbo's task graph encodes build order — everything depends on
> `^build` — so the content bundle compiles before the web app that imports
> it, and caching makes the whole-repo build cheap. The tradeoff I accepted
> is blunt global constraints: for example I pin `@types/react` at the root
> so Next and Expo agree, which is a hammer. And I learned the graph is only
> as good as its edges — my `dev` task didn't declare the dependency, so
> fresh clones hit a 'run content build first' footgun I'd documented in
> prose instead of encoding in the tool."

**Likely follow-up:** "How would this scale to multiple teams — where does a
monorepo start to hurt, and what would you add (ownership boundaries, CI
sharding, versioned packages)?"

### ADR-002 — Functional core, per-platform shells

> "The invariant that mattered most was: web and mobile must grade answers
> and compute progress *identically*, because divergence corrupts user data.
> Instead of sharing UI via React Native Web — which costs you styling
> control on both platforms — I shared logic and duplicated UI. Everything
> hard lives in a pure TypeScript package: grading, the session state
> machine, hearts, streaks, the event reducer. No React, no I/O, and time
> is always a parameter, never `Date.now()` inside — so it's deterministic
> and I can unit-test the whole game engine without mocks. Each app renders
> its own components on top. The lesson I learned is that you have to draw
> the boundary generously: I left the lesson player's *orchestration* — the
> phase machine around the core session — in the apps, so it exists twice
> and genuinely drifted. The fix is a shared headless hook; the JSX can
> stay per-platform."

**Likely follow-up:** "Concretely, how did the two players drift, and how
would a headless hook have prevented it?"

### ADR-003 — Event sourcing, single write path

> "Progress sync across offline devices is a merge problem, and merging
> *state* — 'streak is 12' — needs conflict resolution, while merging
> *facts* — 'lesson X completed at time T' — doesn't. So all progress is an
> append-only event stream in one table, there's exactly one write path,
> `POST /sync`, and both client and server derive state by running the same
> reducer from the same shared package. The payoff was real: I added levels,
> achievements, and a stats dashboard with zero schema migrations, because
> they're just new folds over existing events. The cost I consciously
> deferred is read amplification — the server re-reduces the user's whole
> stream on every sync, which is O(N) with N unbounded. The escape hatch is
> designed in: the reducer takes a baseline, so a snapshot table drops in
> without changing the model. And derived state means the server trusts
> client facts, which is fine single-player but needs server-side
> validation before anything competitive."

**Likely follow-up:** "Walk me through the snapshotting design — what does
correctness require when events can arrive with out-of-order timestamps?"

### ADR-004 — At-least-once + idempotency

> "Over flaky networks you get at-least-once delivery whether you like it or
> not, so I made replays free instead of trying to prevent them. Every event
> gets a client-minted UUID at creation — that id *is* the idempotency key.
> Events queue in a local outbox, flush in batches, and the server's
> composite primary key of user-plus-event-id with insert-on-conflict-do-nothing
> makes any replay a no-op — scoped per user, so nobody can squat on someone
> else's ids. The honest lesson is that an invariant like this has to hold
> at *every* layer, and mine held at exactly one: the database. My web
> client had a UUID fallback that emitted non-UUIDs the server rejected,
> and since the server rejected whole batches and the client retried the
> same batch forever, one bad event could wedge sync permanently — a classic
> poison-message failure. Same idea as a dead-letter queue in a message
> system: the client needs a way to evict what the server will never accept."

**Likely follow-up:** "How would you redesign the batch contract —
per-event accept/reject, and what does the client do with a permanently
rejected event?"

### ADR-005 — Device time and timezones

> "Streaks ask a local-calendar question — 'did you practice today?' — and
> offline completions have to count for the day they happened, not the day
> they synced. So every event carries the device wall-clock timestamp, and
> day-bucketing uses the IANA timezone with proper `Intl` math — I was
> careful to do day arithmetic in calendar space, not by adding 86,400
> seconds, so DST doesn't corrupt streaks. Clock tampering is handled by
> clamping future timestamps at the server on insert. Two distributed-time
> lessons came out of the audit. First, the server stores a per-user
> timezone but the clients never update it — so a traveler gets different
> day-bucketing on server versus client and their goal ring visibly resets
> after sync. Second, timestamp *ties* reduced nondeterministically because
> neither the SQL nor the reducer sort had a tie-break — two same-millisecond
> 'set goal' events could flip winners between requests. Total order needs
> `(occurredAt, id)`, everywhere."

**Likely follow-up:** "Why not use a hybrid logical clock or per-device
sequence numbers instead of wall-clock time?"

### ADR-006 — Content as code

> "I'm the content author as well as the engineer, so I treated course
> content like code: YAML sources in the repo, a compiler that validates
> against strict Zod schemas — including language-specific grading rules
> like Tagalog's ng/nang and hyphenation tolerance — and an immutable,
> versioned JSON bundle as the artifact. I deliberately dropped the spec's
> content tables in Postgres: the API serves bundles from disk, the database
> holds only users and events. That bought me diffable, reviewable,
> pre-validated content, free hosting, and true offline play — the web app
> bundles content at build time, mobile ships it in the binary and hot-swaps
> updates. Two costs: the compiled bundle is a gitignored artifact with no
> type declaration, so consumers cast instead of typecheck — stale builds
> are invisible; and 'schema-valid' isn't 'correct' — a fluent-speaker
> review found a grammar error the compiler could never catch. Structure
> can be automated; correctness needs a human gate."

**Likely follow-up:** "How do content version migrations work — what happens
to a client mid-lesson when a new bundle version lands?"

### ADR-007 — Drizzle + jsonb events

> "For persistence I wanted typed migrations on boring, free-tier Postgres,
> so Drizzle. The interesting choice is the event row: I promote only the
> columns the database itself needs — user id, event id, type, timestamp for
> the index — and store the full event as jsonb, interpreted exclusively by
> the shared reducer. Schema-on-read, basically, but inside Postgres. That's
> why new event types need no DDL: validation lives in Zod at the API
> boundary, not in column constraints, so the whole
> achievements-and-levels feature set shipped without a single migration.
> The tradeoff is concentrated trust: the DB stores whatever validated
> shape arrives, the read path casts rather than parses, and ordering is
> delegated to application code — which is exactly where my missing
> ORDER-BY-plus-tie-break bug lived. If you move invariants out of the
> database, you have to be honest that the application layer now owns them,
> and test it accordingly."

**Likely follow-up:** "When would you promote a jsonb field to a real
column — what signals that, and how do you backfill?"

### ADR-008 — API contract

> "The API surface is five routes, because clients derive state themselves —
> the server's contract job is accepting event batches safely and returning
> derived truth. I validate hard at the boundary: a discriminated-union Zod
> schema per event type, stripped unknown keys, bounded numbers, capped
> batch size — nothing unvalidated ever reaches storage. Two decisions I'd
> revisit. First, I made batch validation all-or-nothing — one invalid event
> 400s everything — which composed terribly with clients that retry the same
> batch forever; per-event accept-reject with the response naming rejected
> ids is strictly better. Second, I validated shape but trusted meaning:
> lesson ids and XP values aren't checked against the course content, which
> is fine for a single-player app but is the first thing to fix before
> leaderboards. The subtler lesson: my event type ended up defined three
> times — TypeScript in core, Zod in the API, constraints in content — and
> they disagreed at the edges. One schema in the shared package, inferred
> types everywhere else."

**Likely follow-up:** "How do you evolve the event schema without breaking
older clients — what's your versioning story for events already in the DB?"

### ADR-009 — Error-handling philosophy

> "The design rule was: loud at the boundary, quiet at the edges. The API
> and the content compiler reject invalid input hard, because bad data is
> forever. But at runtime, the app is offline-first — lessons must never
> block on network health — so the UI applies events locally and instantly,
> the sync worker retries in the background, and sync errors are swallowed;
> missing audio just plays nothing, by design, because I shipped content
> before recording clips. The resilience half worked: with the server
> completely down, guest play and local persistence are fine. What failed
> is that silence can't distinguish *transient* from *permanent*. An expired
> refresh token left users looking logged-in while never syncing again; a
> permanently-rejected batch retried forever; and silent audio failure made
> listening exercises unanswerable while still charging hearts. The
> amendment I'd make: transient errors stay silent and retry; permanent
> errors must either self-heal — evict, re-auth, skip the exercise — or
> surface. And 'unsynced changes' deserves a pixel of UI."

**Likely follow-up:** "Concretely, how do you classify an error as
transient versus permanent at the call site — status codes, error types,
retry budgets?"

### ADR-010 — Testing strategy

> "With solo-dev time, I bet all my testing budget on the pure core — the
> reducer, grading, streak and hearts math — because it's deterministic,
> mock-free, and it's where a bug corrupts user data. Fifty-seven fast
> vitest tests, covering things like order-independence, timezone day-keys
> across DST, and level-curve boundaries; the content compiler doubles as
> the content test suite. That half of the bet paid off — audits keep
> finding that layer solid. The half I got wrong is instructive: the
> severity map of real bugs was almost the photographic negative of my
> coverage map. Every high-severity defect lived in the untested seams —
> the client outbox lifecycle, the sync route's batch semantics, auth
> refresh — precisely because that's where async, storage, and network
> meet. If I re-ran it I'd keep the core suite and add two cheap layers:
> property-based invariant tests on the reducer — permutation and
> duplication invariance would have caught two bugs by itself — and
> `app.inject` integration tests on the one write path. Test where the
> *risk* is, which is usually the seams, not just where testing is
> pleasant."

**Likely follow-up:** "Show me one property-based test you'd write for the
reducer — what's the invariant, the generator, and the shrink story?"

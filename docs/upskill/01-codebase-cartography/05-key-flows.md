# Key Flows

Six end-to-end traces. Later modules rotate among these — none of them reuses one favorite flow. Trace them with the code open; the tables are only scaffolding.

---

## Flow 1: Answering an exercise (web UI)

Why this flow matters: it is the product's core loop and the cleanest example of "UI as a thin shell over a pure engine" — the architecture idea this repo is built on.

Open these files first:
- [LessonPlayer.tsx#L33-L121](../../../apps/web/src/components/LessonPlayer.tsx#L33-L121) — orchestrates phases
- [session.ts#L45-L84](../../../packages/core/src/session.ts#L45-L84) — grading + re-queue
- [TapsView.tsx#L17-L23](../../../apps/web/src/components/exercises/TapsView.tsx#L17-L23) — how a tapped answer is represented

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | UI | [TapsView.tsx#L18-L23](../../../apps/web/src/components/exercises/TapsView.tsx#L18-L23) | user taps chips; indices→words | `string[]` | duplicates handled via indices, not words |
| 2 | UI | [LessonPlayer.tsx#L93-L95](../../../apps/web/src/components/LessonPlayer.tsx#L93-L95) | `check()` calls core | `UserAnswer` | none |
| 3 | core | [session.ts#L68-L83](../../../packages/core/src/session.ts#L68-L83) | `grade()`; correct → drop from queue; wrong → push to back | new `SessionState` (immutable) | queue never shrinks on wrong answers — can loop while hearts last |
| 4 | UI | [LessonPlayer.tsx#L96-L98](../../../apps/web/src/components/LessonPlayer.tsx#L96-L98) | wrong + not practice → append `hearts_lost` event | `ProgressEvent` | event emitted *before* user sees feedback — no undo |
| 5 | store | [progress.tsx#L80-L86](../../../apps/web/src/lib/progress.tsx#L80-L86) | outbox += event; localStorage saved | array in `aral.outbox` | localStorage quota/JSON errors swallowed by `load()` |
| 6 | UI | [LessonPlayer.tsx#L44-L59](../../../apps/web/src/components/LessonPlayer.tsx#L44-L59) | on done, `completionSent` ref guards exactly-one `lesson_completed` | event with `xp`, `perfect` | React StrictMode double-effect is why the ref exists |

Validation and authorization: none — this is client-local; grading is [normalization + allowlisted alternates](../../../packages/core/src/grading.ts#L35-L61).
Persistence and side effects: localStorage only (step 5); audio playback on correct answers ([LessonPlayer.tsx#L99](../../../apps/web/src/components/LessonPlayer.tsx#L99)).
Tests that cover it: [session.test.ts](../../../packages/core/src/session.test.ts) (engine), [grading.test.ts](../../../packages/core/src/grading.test.ts). **No component-level test exists** for LessonPlayer — evidence: no test files outside `packages/core`.
What juniors usually miss: the session state is immutable — `submitAnswer` returns a *new* state; the component stores the "next" state inside the feedback phase and only applies it on Continue ([L113-L119](../../../apps/web/src/components/LessonPlayer.tsx#L113-L119)).
What seniors notice: hearts are read from *derived progress* while the lesson also emits heart events — two sources that could disagree mid-lesson if regen ticks over; benign here but the kind of dual-source-of-truth seam that becomes a bug factory.
Interview angle: "Where should game/business logic live relative to components?" — answer with this exact split and why it made the mobile app nearly free.
Drill: predict what happens if you answer the same exercise wrong 5 times with full hearts, then verify in code. (5 `hearts_lost` events; out-of-hearts screen at [L78-L91](../../../apps/web/src/components/LessonPlayer.tsx#L78-L91) on next render.)
Self-grade — Basic: name files in order. Solid: explain the immutable-state handoff between phases. Strong: articulate the dual-source-of-truth risk and how you'd test it.

---

## Flow 2: `POST /sync` (server API + persistence)

Why this flow matters: it's the only write path for progress (one endpoint to secure, make idempotent, and reason about) and the repo's best interview story about **idempotency** — the property that repeating an operation leaves the same result as doing it once.

Open these files first:
- [sync.ts#L8-L67](../../../apps/api/src/routes/sync.ts#L8-L67) — the whole route
- [schema.ts#L41-L59](../../../packages/db/src/schema.ts#L41-L59) — composite PK
- [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) — derive-on-read

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | auth | [auth.ts#L36-L50](../../../apps/api/src/auth.ts#L36-L50) | Bearer JWT verified; `req.userId` set | JWT sub | 401 on anything invalid |
| 2 | validation | [sync.ts#L8-L33](../../../apps/api/src/routes/sync.ts#L8-L33) | zod discriminated union; ≤500 events; xp ≤100 | `ProgressEvent[]` | schema duplicated from core TS types — drift risk |
| 3 | write | [sync.ts#L47-L60](../../../apps/api/src/routes/sync.ts#L47-L60) | batch insert, timestamps clamped to `now`, `onConflictDoNothing` | rows keyed `(userId, id)` | not wrapped in an explicit transaction (single statement, so atomic anyway) |
| 4 | derive | [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) | load *all* user events, fold with shared `reduceEvents` | `UserProgress` | O(events) per request — fine now, needs a snapshot table at scale |
| 5 | respond | [sync.ts#L62-L64](../../../apps/api/src/routes/sync.ts#L62-L64) | `{accepted, progress}` — client adopts as new baseline | JSON | — |

Validation and authorization: steps 1–2; note authz here is only "you are you" — events can't reference another user because `userId` comes from the token, never the body ([sync.ts#L52](../../../apps/api/src/routes/sync.ts#L52)). That's the IDOR defense.
Persistence and side effects: one insert; no queues, no email — deliberately boring.
Tests that cover it: **No automated coverage.** Verified only by a manual curl smoke test (see [verification log](../09-reference/verification-log.md)). This is the repo's biggest testing gap and ticket #1 material.
What juniors usually miss: `accepted` counts *attempted* inserts; replayed duplicates are silently skipped by the PK conflict — idempotency lives in the schema, not in `if` statements.
What seniors notice: the clamp `Math.min(ev.occurredAt, now)` ([L56-L57](../../../apps/api/src/routes/sync.ts#L56-L57)) defends against future timestamps but *past* timestamps are trusted — a user can backdate completions to repair a streak. Documented as accepted risk? No — see [risk register](../09-reference/risk-register.md).
Interview angle: "Design an idempotent API for offline clients" — this endpoint *is* the model answer: client-generated IDs + unique constraint + conflict-ignore + derived response.
Drill: send the same batch twice with curl and diff the two responses.
Self-grade — Basic: both return 200. Solid: explain why xpTotal is identical. Strong: name two attacks the zod bounds (`xp ≤ 100`, `count ≤ 20`, 500 events) do and don't stop.

---

## Flow 3: Register → login → refresh rotation (auth boundary)

Why this flow matters: token lifecycle questions appear in nearly every mid-level interview; this repo implements the standard pattern small enough to hold in your head.

Open these files first:
- [auth.ts (lib)#L9-L33](../../../apps/api/src/auth.ts#L9-L33) — hashing + token minting
- [routes/auth.ts#L14-L74](../../../apps/api/src/routes/auth.ts#L14-L74) — the three endpoints

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | register | [routes/auth.ts#L15-L33](../../../apps/api/src/routes/auth.ts#L15-L33) | zod (email, pw ≥8); duplicate check; argon2 hash; insert | user row | check-then-insert race → duplicate email possible under concurrency; DB unique constraint is the real guard ([schema.ts#L16](../../../packages/db/src/schema.ts#L16)) — but that path returns a 500, not 409. Investigate. |
| 2 | mint | [routes/auth.ts#L62-L74](../../../apps/api/src/routes/auth.ts#L62-L74) | access JWT (15m) + random refresh token; only its **sha256 hash** stored | `{accessToken, refreshToken}` | refresh token appears once in plaintext, in the response |
| 3 | login | [routes/auth.ts#L35-L43](../../../apps/api/src/routes/auth.ts#L35-L43) | constant lookup + argon2 verify; identical error for bad email vs bad password | — | good: no user enumeration via error text (timing still differs — argon2 only runs when the user exists) |
| 4 | refresh | [routes/auth.ts#L45-L58](../../../apps/api/src/routes/auth.ts#L45-L58) | hash lookup → expiry check → **delete old row** → issue new pair | rotation | delete+insert not in one transaction: crash between them logs the user out (fail-closed — acceptable) |
| 5 | use | [auth.ts#L36-L50](../../../apps/api/src/auth.ts#L36-L50) | `requireAuth` preHandler on `/sync`, `/me` | `req.userId` | — |

Validation and authorization: zod at the edge; argon2 for storage; JWT HS256 with a secret that hard-fails default-value-in-prod ([env.ts#L18-L20](../../../apps/api/src/env.ts#L18-L20)).
Persistence and side effects: `users`, `refresh_tokens` tables. No email verification, no rate limiting (risk register).
Tests that cover it: none automated; manual smoke only.
What juniors usually miss: why store a *hash* of the refresh token — a DB leak must not hand out live sessions. Same reason as password hashing, applied to tokens.
What seniors notice: clients keep tokens in localStorage ([web progress.tsx#L21](../../../apps/web/src/lib/progress.tsx#L21)) — XSS-readable. The standard hardening is httpOnly cookies + CSRF defense; that tradeoff (simplicity vs XSS exposure) is a great interview answer *when you name it yourself*.
Interview angle: "Walk me through access vs refresh tokens." Use this flow; mention rotation making stolen refresh tokens single-use.
Drill: with curl, refresh twice with the same token; predict then confirm the second call's status (401 — the row was deleted).
Self-grade — Strong adds: where you'd put rate limiting and why register/login/refresh specifically.

---

## Flow 4: YAML lesson → compiled bundle → three clients (content pipeline)

Why this flow matters: "content as code with a compile step" is a pattern you'll meet in i18n, CMS exports, and config pipelines; it also shows contract enforcement at *build time* instead of runtime.

Open these files first:
- [schema.ts (content)#L1-L60](../../../packages/content/src/schema.ts) — authoring schema (zod)
- [compile.ts#L63-L127](../../../packages/content/src/compile.ts#L63-L127) — authored → runtime transform
- [compile.ts#L132-L186](../../../packages/content/src/compile.ts#L132-L186) — validation, manifest, versioned output

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | author | [units/01-greetings.yaml](../../../packages/content/course/en-tl/units/01-greetings.yaml) | human-friendly YAML (`prompt_tl`/`answer_en` sugar) | YAML | typos |
| 2 | validate | [compile.ts#L137-L143](../../../packages/content/src/compile.ts#L137-L143) | zod parse per unit; all errors printed; exit 1 | `AuthoredUnit` | strict schemas reject unknown keys — good |
| 3 | transform | [compile.ts#L63-L110](../../../packages/content/src/compile.ts#L63-L110) | infer direction; auto word bank via deterministic shuffle ([L31-L47](../../../packages/content/src/compile.ts#L31-L47)) | `Exercise` union | seeded shuffle keeps bundles reproducible — why? diffable artifacts |
| 4 | audio | [compile.ts#L149-L156](../../../packages/content/src/compile.ts#L149-L156) | manifest of refs; missing files warn, don't fail | `Record<ref,path>` | shipping 404 audio is a product decision, made explicit |
| 5 | emit | [compile.ts#L179-L186](../../../packages/content/src/compile.ts#L179-L186) | `course_en_tl.json` + versioned copy + manifest | immutable artifact | version bump is manual (course.yaml) — forgettable |
| 6a | web | [content.ts#L2-L9](../../../apps/web/src/lib/content.ts#L2-L9) | imports bundle at build time | in-bundle JSON | content updates require redeploy |
| 6b | mobile | [mobile content.ts#L8-L27](../../../apps/mobile/src/lib/content.ts#L8-L27) | ships bundle in binary; hot-swaps newer downloaded version | SQLite kv | shipped>cached guard at [L10-L11](../../../apps/mobile/src/lib/content.ts#L10-L11) |
| 6c | api | [routes/content.ts#L11-L27](../../../apps/api/src/routes/content.ts#L11-L27) | serves files with `immutable` cache headers | HTTP | filename allowlist regex is the path-traversal defense |

Validation and authorization: all at build time (zod) + filename regex at serve time. Content endpoints are intentionally public.
Persistence and side effects: filesystem artifacts only.
Tests that cover it: none direct; the compiler run itself is the check (exit 1 on invalid content — verified).
What juniors usually miss: why *versioned immutable* files — so clients can cache forever and "update" means "fetch a new name," never "revalidate the old one." That's the same idea as content-hashed JS bundles.
What seniors notice: web (6a) and mobile (6b) chose *different* delivery models for the same artifact, each matching its platform's constraint (redeploys are cheap on Vercel; app-store releases are not). Being able to justify divergence is senior judgment.
Interview angle: "How would you version config/content consumed by mobile apps you can't force-update?"
Drill: break the YAML (remove a required `answer`) and run `pnpm content:build`; read the error; fix it.
Self-grade — Strong: explain why validation errors at build time are categorically cheaper than at runtime.

---

## Flow 5: Offline completion → background sync (mobile async flow)

Why this flow matters: queues-with-retry is the classic async reliability question, here in its simplest honest form: an **outbox** (buffer of pending writes that survives restarts).

Open these files first:
- [storage.ts#L12-L66](../../../apps/mobile/src/lib/storage.ts#L12-L66) — SQLite kv + outbox tables
- [mobile progress.tsx#L62-L118](../../../apps/mobile/src/lib/progress.tsx#L62-L118) — sync worker

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | UI | mobile [LessonPlayer.tsx](../../../apps/mobile/src/components/LessonPlayer.tsx) | completion → `addEvents` | `ProgressEvent` | — |
| 2 | store | [storage.ts#L42-L53](../../../apps/mobile/src/lib/storage.ts#L42-L53) | `INSERT OR IGNORE` into outbox, in a transaction | SQLite row | sync API on JS thread — fine at this write volume |
| 3 | trigger | [progress.tsx#L106-L110](../../../apps/mobile/src/lib/progress.tsx#L106-L110) | 2s debounce after any event | — | no exponential backoff — retries only on next trigger |
| 4 | trigger | [progress.tsx#L112-L117](../../../apps/mobile/src/lib/progress.tsx#L112-L117) | AppState → sync on foreground | — | no connectivity listener; offline attempt just fails and waits |
| 5 | push | [progress.tsx#L62-L82](../../../apps/mobile/src/lib/progress.tsx#L62-L82) | POST outbox; on 401 refresh once and retry; on success clear outbox + adopt baseline | `{accepted, progress}` | outbox >500 events would be rejected by the server cap — **investigate**: no client-side chunking |
| 6 | derive | [progress.tsx#L52-L55](../../../apps/mobile/src/lib/progress.tsx#L52-L55) | UI state = `reduceEvents(outbox, tz, now, baseline)` | `UserProgress` | — |

Validation and authorization: server-side (Flow 2); the client trusts its own SQLite.
Persistence and side effects: SQLite writes; network. Streaks stay correct offline because events carry device timestamps and the reducer uses those, not sync time ([events.ts#L61-L67](../../../packages/core/src/events.ts#L61-L67)).
Tests that cover it: reducer covered in [events.test.ts](../../../packages/core/src/events.test.ts); the worker itself is untested and **unverified on a device** (see verification log).
What juniors usually miss: why clear-outbox-only-after-server-ack ordering matters — reverse it and a crash loses progress forever.
What seniors notice: exactly-once is achieved as *at-least-once delivery + idempotent receiver*. Saying that sentence, then pointing at the composite PK, is a senior interview moment.
Interview angle: "How do you sync offline mutations without duplicates or loss?"
Drill: enumerate the crash points (after step 2, mid step 5, after ack before clear) and state the outcome of each. All should be "safe."
Self-grade — Strong: you also identify the >500-event edge and propose chunked pushes.

---

## Flow 6: Hearts regeneration & running out (domain/time flow)

Why this flow matters: time-based state without timers or cron is a recurring senior trick; it also demonstrates a real **invariant** (a condition the code must keep true everywhere: `0 ≤ hearts ≤ 5`).

Open these files first:
- [hearts.ts#L13-L49](../../../packages/core/src/hearts.ts#L13-L49) — the whole mechanism
- [hearts.test.ts](../../../packages/core/src/hearts.test.ts) — boundary tests

Trace:
| Step | Owner | File | What happens | Data shape | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | state | [hearts.ts#L8-L11](../../../packages/core/src/hearts.ts#L8-L11) | state = `{hearts, updatedAt}`; regen is *computed*, never scheduled | 2 fields | — |
| 2 | read | [hearts.ts#L18-L27](../../../packages/core/src/hearts.ts#L18-L27) | `regenerate` advances `updatedAt` by whole intervals only — keeps partial progress | — | off-by-one at exact boundaries covered by [tests](../../../packages/core/src/hearts.test.ts#L20-L27) |
| 3 | lose | [hearts.ts#L29-L35](../../../packages/core/src/hearts.ts#L29-L35) | regen first, then decrement; anchor resets when falling from full | — | floor at 0 |
| 4 | UI | [Header.tsx](../../../apps/web/src/components/Header.tsx) + 30s tick in [progress.tsx#L70-L72](../../../apps/web/src/lib/progress.tsx#L70-L72) | re-render clock so displayed hearts update | — | UI can lag ≤30s — cosmetic |
| 5 | refill | practice completion → `addHearts(…,1)` inside the reducer ([events.ts#L68-L70](../../../packages/core/src/events.ts#L68-L70)) | — | — |

Validation and authorization: server clamps event timestamps and heart counts at `/sync` ([sync.ts#L24-L31,L56](../../../apps/api/src/routes/sync.ts#L24-L31)).
Persistence and side effects: none of its own — hearts are pure derivation. That's the point.
Tests that cover it: [hearts.test.ts](../../../packages/core/src/hearts.test.ts) — including backwards-time and exact-boundary cases.
What juniors usually miss: `updatedAt` advances by `gained * HEART_REGEN_MS`, not to `now` ([L23-L26](../../../packages/core/src/hearts.ts#L23-L26)) — otherwise partial regen progress would be lost on every read. Read-triggered state must be careful not to destroy information.
What seniors notice: the design means no background job, no timer drift, no server clock dependency — offline correctness for free. The cost: every consumer must remember to call `regenerate` before reading; forgetting is a silent bug. An API that made stale reads unrepresentable (e.g., only exposing `currentHearts(state, now)`) would be safer.
Interview angle: "Design energy/lives that refill over time" — lazy evaluation from timestamps beats cron; say why (offline, scale, drift).
Drill: compute by hand the hearts shown for `{hearts: 1, updatedAt: T}` at `T+3h59m`, `T+4h`, `T+8h1m`, then check against `regenerate`.
Self-grade — Strong: propose the API change that eliminates the forgot-to-regenerate bug class, and name its cost.

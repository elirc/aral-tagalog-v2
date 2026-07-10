# Pattern Catalog

14 cards. Goal is *recognition in the wild*, not name-dropping. Each drill takes minutes.

---

## Pattern 1: Event Sourcing (lite)
Problem it solves: syncing mutable state across offline devices without conflict resolution hell.
General shape: store immutable facts; derive state by folding; never update in place.
Real example: [events.ts#L13-L86](../../../packages/core/src/events.ts#L13-L86); storage at [db schema.ts#L41-L59](../../../packages/db/src/schema.ts#L41-L59).
Second example: migrations directory is append-only for the same reason ([packages/db/migrations](../../../packages/db/migrations)).
Why this implementation works: one reducer shared by server and clients — semantic convergence by construction.
Failure modes: unbounded growth (no snapshots yet); event schema becomes eternal contract; reducers must stay order-independent.
Use it when: offline/multi-writer sync, audit requirements. Avoid when: simple CRUD with one writer — the ceremony costs more than it saves.
Interview angle: "How would you build offline sync?" — this card is the answer.
Drill: write the `UserProgress` you'd get from: lose 2 hearts, complete lesson (perfect), practice same lesson. Verify with a quick vitest scratch test.

## Pattern 2: Idempotency Key
Problem it solves: retries and replays must not double-apply.
General shape: caller generates a unique operation id; receiver upserts/ignores on conflict.
Real example: client UUID + composite PK + [`onConflictDoNothing`](../../../apps/api/src/routes/sync.ts#L60); key uniqueness scoped per user ([schema.ts#L57](../../../packages/db/src/schema.ts#L57)).
Second example: `INSERT OR IGNORE` in the mobile outbox ([storage.ts#L45-L50](../../../apps/mobile/src/lib/storage.ts#L45-L50)) — same idea, device-local.
Why it works: the *database* enforces it; app code can't forget.
Failure modes: key generated per-attempt instead of per-operation (breaks the whole point); global instead of per-tenant keys (cross-user denial).
Use when: any at-least-once channel (webhooks, payments, queues). Avoid when: truly read-only ops.
Interview angle: "Design a payment endpoint safe under retries."
Drill: find the bug — an API that generates the idempotency key *server-side* on receipt. (It dedupes nothing: each retry gets a fresh key.)

## Pattern 3: Derive, Don't Store
Problem it solves: cached aggregates (xp totals, streaks) drifting from their source.
General shape: keep the source of truth minimal; compute views on read.
Real example: `/me` derives everything per request ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)); no `user_state` table exists.
Second example: hearts computed from `{hearts, updatedAt}` + now ([hearts.ts#L18-L27](../../../packages/core/src/hearts.ts#L18-L27)) — no scheduled ticks.
Why it works: derivation is pure and cheap at this scale; staleness is impossible.
Failure modes: O(history) reads at scale; hot-path recomputation. Escalation: materialize a snapshot **keyed to last event id** so it's verifiably rebuildable.
Use when: history is small or reads are rare. Avoid when: leaderboards over millions of users — precompute then.
Interview angle: cache-invalidation questions — the strongest answer is often "don't cache yet, and here's the metric that tells me when to start."
Drill: estimate events/user/year for a daily learner (~15/day ≈ 5.5k/year). At what count does per-request reduce actually hurt (measure: reduce 100k synthetic events in vitest)?

## Pattern 4: Pure Core, Imperative Shell
Problem it solves: business rules tangled with I/O are untestable and unportable.
General shape: rules as pure functions in a dependency-free package; apps adapt I/O to/from it.
Real example: all of [packages/core](../../../packages/core/src) (note `now` as parameter, [events.ts#L49-L54](../../../packages/core/src/events.ts#L49-L54)); three shells consume it.
Second example: content compiler is a pure transform between two file reads ([compile.ts#L63-L127](../../../packages/content/src/compile.ts#L63-L127)).
Failure modes: the shell grows logic anyway (watch clients' store files — policy is creeping there); core sprouts a sneaky host dependency.
Use when: logic used by >1 surface or needing dense tests. Avoid when: one-off glue.
Interview angle: "how do you make business logic testable?"
Drill: point at the one place lesson-completion *policy* lives in a shell instead of core ([LessonPlayer.tsx#L48-L58](../../../apps/web/src/components/LessonPlayer.tsx#L48-L58) — xp calc composed at the UI edge). Propose the core function that would absorb it.

## Pattern 5: Outbox (client-side)
Problem it solves: writes made while offline must survive until deliverable.
General shape: persist intent locally; a worker drains to the network; clear only on ack.
Real example: [web progress.tsx#L80-L124](../../../apps/web/src/lib/progress.tsx#L80-L124); [mobile storage.ts#L42-L66](../../../apps/mobile/src/lib/storage.ts#L42-L66).
Second example: none server-side (no queue) — say "No second example found" and know why.
Failure modes: clearing before ack (data loss); no size cap (500-event server limit vs unchunked client push — investigate); no user-visible "unsynced" indicator.
Interview angle: "offline-first mutations."
Drill: enumerate crash points and outcomes (done in [Flow 5](../01-codebase-cartography/05-key-flows.md)); now add: what if `markSynced`/outbox-clear itself fails?

## Pattern 6: Baseline + Delta Overlay
Problem it solves: client can't hold the full event history but must show correct state including unsynced work.
General shape: server returns authoritative snapshot; client folds only local deltas on top.
Real example: `reduceEvents(outbox, tz, now, baseline)` — the `initial` param ([events.ts#L49-L56](../../../packages/core/src/events.ts#L49-L56)); adopted after each sync ([web #L91-L96](../../../apps/web/src/lib/progress.tsx#L91-L96)).
Second example: [mobile progress.tsx#L52-L55](../../../apps/mobile/src/lib/progress.tsx#L52-L55).
Why it works: snapshot+delta = same result as full fold, proven by the baseline test ([events.test.ts#L49-L62](../../../packages/core/src/events.test.ts#L49-L62)).
Failure modes: overlaying deltas already contained in the baseline (double count) — prevented by clearing outbox exactly when baseline is adopted, atomically-ish. Spot that coupling; it's subtle and untested on the failure path.
Interview angle: "how do you reconcile client and server state after reconnect?"
Drill: describe the bug if the outbox clear at [web #L94-L95](../../../apps/web/src/lib/progress.tsx#L94-L95) ran *before* `setBaseline`.

## Pattern 7: Discriminated Union Contract
Problem: many message/exercise kinds flowing through one channel, each with different fields.
Shape: `{ type: "a", ... } | { type: "b", ... }` + exhaustive switch.
Real: exercises ([types.ts#L108-L114](../../../packages/core/src/types.ts#L108-L114)); events ([events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31)); mirrored in zod `discriminatedUnion` ([sync.ts#L8](../../../apps/api/src/routes/sync.ts#L8), [content schema.ts](../../../packages/content/src/schema.ts)).
Failure modes: forgetting the runtime mirror (types erase!); non-exhaustive default cases that swallow new variants silently.
Interview angle: "model a webhook payload with several event types."
Drill: from [fake-code contrasts #8](../04-code-reading-gym/03-fake-code-contrasts.md), refactor the class-hierarchy version into a union.

## Pattern 8: Compile-Time Content Validation
Problem: bad data shipping to production when content is edited by humans.
Shape: authoring format → validator → immutable versioned artifact; CI/build fails loudly.
Real: [compile.ts#L132-L186](../../../packages/content/src/compile.ts#L132-L186) — zod strict, duplicate-id check, exit 1 with all errors.
Second: TS itself (types are compile-time validation of code-as-data).
Failure modes: validator drifts from runtime expectations; warnings (missing audio) trained-to-ignore.
Interview angle: "how would you let non-engineers edit config safely?"
Drill: add a compiler lint (on paper): every `listen` exercise's `answer_tl` words must appear in its `wordBank`. Where does it go? ([compileExercise](../../../packages/content/src/compile.ts#L63) or post-pass?)

## Pattern 9: Immutable Versioned Artifacts
Problem: caches and clients you can't force-refresh.
Shape: content-addressed/versioned names; `cache-control: immutable`; updates are new names.
Real: `course_en_tl_v1.json` + [immutable headers](../../../apps/api/src/routes/content.ts#L26-L27); mobile version comparison ([mobile content.ts#L21-L27](../../../apps/mobile/src/lib/content.ts#L21-L27)).
Failure modes: mutating a published version (cache poisoning-by-yourself); forgetting to bump ([course.yaml](../../../packages/content/course/en-tl/course.yaml) version is manual).
Interview angle: CDN/cache-busting questions; also app-store constraint stories.
Drill: what exactly breaks if you edit `course_en_tl_v1.json` in place after clients cached it? Walk both web and mobile.

## Pattern 10: Token Pair with Rotation
Problem: long sessions without long-lived bearer secrets.
Shape: short access JWT + long random refresh token, hashed at rest, single-use.
Real: [auth.ts#L13-L33](../../../apps/api/src/auth.ts#L13-L33), rotation at [routes/auth.ts#L45-L58](../../../apps/api/src/routes/auth.ts#L45-L58).
Failure modes: no reuse-detection (a stolen-then-used token isn't flagged when victim's copy fails); tokens in XSS-readable storage (web).
Interview angle: "JWT session design" — always mention rotation + hashed storage.
Drill: write the SQL you'd run to force-logout one user everywhere. (`DELETE FROM refresh_tokens WHERE user_id = $1` — and note access tokens survive ≤15min.)

## Pattern 11: Provider Interface Seam (ads)
Problem: vendor SDK must not leak into shared logic; personal builds need it off.
Shape: interface in core; platform implements; no-op default.
Real: [ads.ts#L5-L17](../../../packages/core/src/ads.ts#L5-L17), consumed via cadence constant in mobile player.
Second example: audio playback is *nearly* this (per-platform `playAudio` with same call shape: [web](../../../apps/web/src/lib/audio.ts) / [mobile](../../../apps/mobile/src/lib/audio.ts)) — convergent, not formalized.
Failure modes: interface designed after the SDK (leaks vendor types); seams nobody implements rot.
Interview angle: "how do you keep third-party SDKs swappable/testable?"
Drill: sketch `AdsProvider`'s AdMob implementation signature-only; confirm nothing in core would change.

## Pattern 12: Deterministic Generation (seeded shuffle)
Problem: generated artifacts should be reproducible → diffable, cacheable, debuggable.
Shape: seed randomness from stable input (id), never `Math.random()` in build steps.
Real: [compile.ts#L31-L47](../../../packages/content/src/compile.ts#L31-L47) (FNV-ish hash → PRNG), seeded per exercise id.
Second: UI option shuffles seeded from exercise id so options don't jump between renders ([ChoiceView.tsx#L7-L18](../../../apps/web/src/components/exercises/ChoiceView.tsx#L7-L18)).
Failure modes: seed too coarse (same order everywhere); accidentally reseeding per render.
Interview angle: reproducible builds; also "why did your snapshot test flake?"
Drill: what changes in `git diff` of the bundle when you edit one lesson? (Only that lesson — because shuffles elsewhere are stable. That's the point.)

## Pattern 13: Fail-Silent Degradation (audio)
Problem: optional enrichments must not block the core loop.
Shape: try the enhancement; on failure, do nothing; never throw across the feature boundary.
Real: [web audio.ts#L8-L14](../../../apps/web/src/lib/audio.ts#L8-L14); [mobile audio.ts#L16-L31](../../../apps/mobile/src/lib/audio.ts#L16-L31).
Failure modes: silence hides *systemic* failure (all audio broken, nobody knows — no metric). Fail-silent needs a counter somewhere; here there is none (observability gap, flagged).
Use when: progressive enhancement. Avoid when: the effect is the product (payments!).
Interview angle: graceful degradation vs error propagation — when each.
Drill: add (on paper) the one line that would make this observable without making it loud.

## Pattern 14: Guarded Exactly-Once UI Effect
Problem: React effects fire ≥ once; some actions must commit once.
Shape: `useRef(false)` latch (or idempotent downstream).
Real: [`completionSent`](../../../apps/web/src/components/LessonPlayer.tsx#L39-L47); mobile mirror ([mobile LessonPlayer.tsx#L44-L52](../../../apps/mobile/src/components/LessonPlayer.tsx#L44-L52)).
Why it works *here*: belt (ref) and suspenders (server-side idempotency) — even if the latch fails, the event id dedupes.
Failure modes: latch in state instead of ref (re-render races); relying on latch alone with non-idempotent backend.
Interview angle: StrictMode double-invoke questions.
Drill: delete the ref in a scratch branch, run dev with StrictMode, observe the double event locally (then check: would the server have deduped it? Same id? No — `newEventId()` runs twice. So the latch is load-bearing. Good catch.)

# Good First Tickets

16 junior tickets spread across the repo. Template fields compressed; all present. Estimated times assume the fast track is done.

---

## Ticket 1: CI workflow for tests + typecheck + content build
Difficulty: Easy — 2h. Skills: CI, monorepo scripts.
Story: As a maintainer, I want every push checked so regressions can't land silently.
Why good: the repo has tests but **no CI at all** — maximal value, zero product code.
Acceptance: - [ ] GitHub Actions workflow runs `pnpm install`, `pnpm content:build`, `pnpm -r typecheck`, `pnpm test` on push/PR - [ ] fails on any red step.
Read first: [package.json scripts](../../../package.json), [verification log](../09-reference/verification-log.md) for the verified command list.
Files touched: `.github/workflows/ci.yml` (new only).
Plan: 1. pnpm/action-setup + node 20 cache. 2. steps in dependency order (content before typecheck — web's typecheck needs the bundle). 3. Badge in README optional.
What could go wrong: forgetting content:build → web typecheck fails mysteriously (that ordering *is* the learning).
Rejection risk: pinning no versions; running docker-dependent steps (db) that CI can't do yet — keep scope to the four commands.
Interview story potential: "I added CI to an untested-in-CI monorepo and had to encode the build graph's hidden ordering."

## Ticket 2: Request timeouts on all client fetches
Difficulty: Easy — 1h. Skills: fetch API, failure modes.
Story: As a user on flaky wifi, sync attempts shouldn't hang forever.
Why good: one-line pattern (`AbortSignal.timeout(10_000)`) applied at a single choke point per client; tiny blast radius because every call already flows through one `request()` helper — [web api.ts#L18-L27](../../../apps/web/src/lib/api.ts#L18-L27), [mobile api.ts#L29-L40](../../../apps/mobile/src/lib/api.ts#L29-L40).
Acceptance: - [ ] all API calls abort after 10s - [ ] aborted sync retains outbox (verify by pointing API URL at a blackhole).
Rejection risk: adding per-call custom timeouts (YAGNI) or a retry library.
Interview story: "closing an unbounded-latency hole at a single boundary."

## Ticket 3: Deep health check
Difficulty: Easy — 1h. Skills: operational thinking.
Story: As an operator, `/health` should fail when Postgres is unreachable.
Why good: current check lies ([app.ts#L21](../../../apps/api/src/app.ts#L21)); fix is a `SELECT 1`.
Acceptance: - [ ] `/health` 200 with db up, 503 with db down (test by stopping docker) - [ ] response stays fast (<50ms) via short query timeout.
Follows pattern: existing route style in [app.ts](../../../apps/api/src/app.ts).
Rejection risk: making it *too* deep (checking content files, etc.) — health checks must stay cheap; discuss shallow-vs-deep in the PR ([observability notes](../05-quality-engineering/06-observability-and-operations.md)).
Interview story: "shallow health checks and what LBs actually need."

## Ticket 4: Surface unsynced-changes indicator (web)
Difficulty: Easy-Medium — 3h. Skills: React context, UX for eventual consistency.
Story: As a user, I want to know my progress hasn't reached the server yet.
Why good: closes the repo's biggest observability gap from the *user* side; read-only UI change.
Read first: [progress.tsx#L44-L152](../../../apps/web/src/lib/progress.tsx#L44-L152) (outbox already in context? — no: you must expose `outbox.length`), [Header.tsx](../../../apps/web/src/components/Header.tsx).
Acceptance: - [ ] badge appears when outbox non-empty & logged in - [ ] disappears after sync - [ ] guests see nothing.
What could go wrong: exposing the whole outbox array causes consumer re-renders per event — expose the count.
Interview story: "making eventual consistency legible to users."

## Ticket 5: Fix silent JSON-shape hole in web storage
Difficulty: Easy — 2h. Skills: defensive parsing.
Story: As a developer, corrupted localStorage shouldn't produce NaN hearts.
Read first: [progress.tsx#L23-L31](../../../apps/web/src/lib/progress.tsx#L23-L31) — JSON errors caught, wrong shapes not.
Acceptance: - [ ] outbox entries failing a lightweight shape check are dropped with a console.warn - [ ] baseline likewise.
Follows: the zod-at-boundaries philosophy ([type contracts](../02-stack-and-language-mastery/03-type-system-and-contracts.md)); note core has no zod — either hand-rolled guards or move event schemas to core first (link Ticket M2 — say so in the PR).
Rejection risk: adding zod dependency to core casually — that's a design decision above this ticket's pay grade; hand-roll or coordinate.
Interview story: "trust boundaries include your own storage."

## Ticket 6: `DELETE /me` account deletion with re-auth
Difficulty: Medium — 4h. Skills: authz, cascade semantics.
Story: As a user, I can delete my account and data.
Read first: [me.ts](../../../apps/api/src/routes/me.ts), cascade FKs at [schema.ts#L28-L47](../../../packages/db/src/schema.ts#L28-L47), and review [kata 5](../04-code-reading-gym/04-review-katas.md) — this ticket is that kata done right.
Acceptance: - [ ] requires current password in body - [ ] cascades tokens+events (FK does it; assert) - [ ] 401 without valid password - [ ] client clears local stores after.
Interview story: "irreversible operations need stronger auth than the session."

## Ticket 7: Per-event rejection in /sync instead of whole-batch 400
Difficulty: Medium — 3h. Skills: API semantics, poison messages.
Story: As a mobile user with one corrupted event, my other progress should still sync.
Read first: [sync.ts#L42-L44](../../../apps/api/src/routes/sync.ts#L42-L44) (batch-rejecting zod), scenario 2 in [debugging](../05-quality-engineering/03-systematic-debugging.md).
Acceptance: - [ ] valid events accepted, invalid listed in response `rejected: [{index, reason}]` - [ ] client quarantines rejects (web minimal: drop with warn).
What could go wrong: silently dropping user data — the response contract must make rejects visible; document it.
Interview story: "poison-message handling in a sync pipeline."

## Ticket 8: Content lint — listen answers must be buildable from the word bank
Difficulty: Easy-Medium — 2h. Skills: build-time validation.
Story: As a content author, the compiler should catch an answer word missing from the bank (currently an unplayable exercise reaches users).
Read first: [compile.ts#L63-L110](../../../packages/content/src/compile.ts#L63-L110), the cross-package invariant found in [annotation drill 8](../04-code-reading-gym/01-annotation-drills.md).
Acceptance: - [ ] compiler errors listing exercise id when any `answer`/`accept` token is absent from `wordBank` (normalized comparison — reuse core's `normalizeAnswer`) - [ ] existing course passes.
Interview story: "moved a runtime failure to a build failure."

## Ticket 9: Rate limiting on auth routes
Difficulty: Medium — 3h. Skills: abuse prevention, Fastify plugins.
Story: As an operator, login/register/refresh should resist brute force.
Read first: [app.ts#L16-L28](../../../apps/api/src/app.ts#L16-L28); `@fastify/rate-limit` docs (follows existing `@fastify/cors` plugin pattern).
Acceptance: - [ ] e.g. 10/min/IP on the three auth routes - [ ] 429 with retry-after - [ ] `/sync` unaffected.
Rejection risk: global limiter breaking sync bursts; per-route config required.
Interview story: "layered defense for credential endpoints."

## Ticket 10: Remove the MatchView audio-ref guess
Difficulty: Easy — 1h. Skills: contracts over conventions.
Story: As a maintainer, UI shouldn't derive audio refs from display text.
Read first: [MatchView.tsx#L39](../../../apps/web/src/components/exercises/MatchView.tsx#L39), bundle audio map ([types.ts#L18-L19](../../../packages/core/src/types.ts#L18-L19)).
Acceptance: - [ ] pair audio plays only via a real ref looked up from vocab (requires threading vocab data or dropping the feature — propose in PR; dropping is acceptable) - [ ] no string-munging remains.
Interview story: tiny, but perfect review-comment material — "found an implicit naming contract."

## Ticket 11: `tz` update on login
Difficulty: Easy-Medium — 2h. Skills: cross-layer data flow.
Story: As a traveling user, my streak day boundary should follow my current device tz.
Read first: register sends tz ([AuthForm.tsx#L24-L26](../../../apps/web/src/components/AuthForm.tsx#L24-L26)) but login doesn't; server streaks derive from `users.tz` ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13), [me.ts PATCH](../../../apps/api/src/routes/me.ts#L19-L27)).
Acceptance: - [ ] after login, client PATCHes tz if different - [ ] debate captured in PR: should it be automatic? (see review [kata 8](../04-code-reading-gym/04-review-katas.md) for why this is subtle).
Interview story: "timezone as *stored user data* vs device property."

## Ticket 12: Register returns 409 under race (TOCTOU fix)
Difficulty: Medium — 2h. Skills: DB constraints as source of truth.
Story: from [debugging scenario 3](../05-quality-engineering/03-systematic-debugging.md) — catch Postgres `23505`, return the same 409 as the pre-check path ([routes/auth.ts#L20-L23](../../../apps/api/src/routes/auth.ts#L20-L23)).
Acceptance: - [ ] concurrent duplicate registers → one 201, one 409, zero 500s (repro script in PR).
Interview story: "check-then-act races and constraint-backed fixes."

## Ticket 13: Chunk client pushes to respect the 500-event cap
Difficulty: Easy-Medium — 2h. Skills: pagination-in-reverse.
Read first: [sync.ts#L33](../../../apps/api/src/routes/sync.ts#L33) cap vs unchunked pushes ([web #L88-L96](../../../apps/web/src/lib/progress.tsx#L88-L96), [mobile #L62-L69](../../../apps/mobile/src/lib/progress.tsx#L62-L69)).
Acceptance: - [ ] outboxes >500 sync in batches, each ack'd before the next - [ ] partial failure keeps remaining events.
Interview story: "found a latent limit mismatch between client and server before it hit."

## Ticket 14: Practice-mode explainer + heart refill visibility
Difficulty: Easy — 2h. Skills: product empathy, React.
Story: As a player at 0 hearts, I'm told practice refills a heart, but completion UI barely shows it ([LessonPlayer.tsx#L62-L74](../../../apps/web/src/components/LessonPlayer.tsx#L62-L74)).
Acceptance: - [ ] out-of-hearts screen links directly to a completed lesson (practice) - [ ] completion screen animates/emphasizes +1 heart when practice.
Interview story: gamification loop closure — small UI, real retention logic.

## Ticket 15: Migration dry-run docs + `db:generate` root script
Difficulty: Easy — 1h. Skills: DX, migrations.
Story: As a contributor, I shouldn't need to know drizzle-kit's invocation details.
Read first: [packages/db/package.json](../../../packages/db/package.json), root [package.json](../../../package.json).
Acceptance: - [ ] `pnpm db:generate` at root - [ ] README snippet: schema-change workflow (edit → generate → review SQL → migrate) per [data-model guide](../03-architecture-and-patterns/02-data-model-and-persistence.md).
Interview story: minor, but demonstrates paved-path thinking.

## Ticket 16: Vitest coverage report for core
Difficulty: Easy — 1h. Skills: tooling.
Acceptance: - [ ] `pnpm --filter @aral/core test -- --coverage` works (add `@vitest/coverage-v8` devDep) - [ ] CI (Ticket 1) uploads/prints summary - [ ] no coverage *gate* yet (gates without owner buy-in get reverted — say this in the PR).
Interview story: "introduced measurement before mandates."

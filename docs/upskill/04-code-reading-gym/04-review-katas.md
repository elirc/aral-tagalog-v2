# Review Katas

Eight fake PRs against this repo. For each: write your review *before* reading expected findings. Findings are graded **Blocking** (must fix), **Important** (fix or file follow-up), **Optional** (style/nit). Practice kind, specific language — comments quote the concern, propose a direction, and say why.

## Kata 1: "Add daily XP goal"
Author intent: show a progress ring toward a daily goal.
Fake diff summary: adds `dailyGoal` column to `users`; new endpoint `POST /goal`; UI reads `progress.xpToday` computed in `Header.tsx` by filtering `outbox` events by date with `new Date().toDateString()`.
Files this resembles: [me.ts#L19-L27](../../../apps/api/src/routes/me.ts#L19-L27), [Header.tsx](../../../apps/web/src/components/Header.tsx).
Expected findings — Blocking: date filtering with `toDateString()` ignores the user's tz semantics used everywhere else ([streak.ts#L14-L21](../../../packages/core/src/streak.ts#L14-L21)) — daily xp will disagree with streaks; computation belongs in core's reducer, not a component. Important: new endpoint duplicates `PATCH /me` (settings are LWW there); outbox alone misses baseline events (undercounts after sync). Optional: naming.
Good review comment example: > "Streak days use `localDayKey` with the user's IANA tz; computing 'today' with `toDateString()` will disagree around midnight. Could we derive xpToday inside `reduceEvents` so both share day logic?"

## Kata 2: "Retry sync with exponential backoff"
Intent: reliability improvement.
Fake diff: wraps `syncNow` in a `while` loop with `await sleep(2 ** n * 1000)` up to n=10, inside the React effect.
Resembles: [progress.tsx#L108-L124,L137-L141](../../../apps/web/src/lib/progress.tsx#L108-L141).
Expected — Blocking: unbounded async loop inside an effect without cancellation → zombie loops after unmount/logout; also serializes with the existing debounce into overlapping cycles. Important: max total wait ≈17min holds the in-flight guard; no jitter (thundering herd). Optional: extract backoff into a tested pure helper.

## Kata 3: "Cache /me in Redis"
Intent: perf.
Fake diff: adds Redis; caches `getUserProgress` for 60s keyed by userId; invalidates on `/sync`.
Resembles: [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13).
Expected — Blocking: introduces the drift class the architecture deliberately avoids, for an endpoint with no measured latency problem (premature; no benchmark in PR). Important: invalidation misses `PATCH /me` (tz change alters streak derivation!). Optional: if ever needed, snapshot-keyed-by-last-event-id beats TTL. This kata tests saying *no* kindly: ask for the p95 measurement first.

## Kata 4: "Show correct answer for match pairs"
Intent: UX parity — other exercise types show the right answer on miss.
Fake diff: `MatchView` calls `grade(exercise, answer)` and renders `correctAnswer`.
Resembles: [grading.ts#L54-L57](../../../packages/core/src/grading.ts#L54-L57) (match_pairs returns `correct: true, correctAnswer: ""`), [MatchView.tsx](../../../apps/web/src/components/exercises/MatchView.tsx).
Expected — Blocking: `grade()` for match_pairs is explicitly a stub; the diff renders an empty string and "passes" — author didn't read the core contract. Important: the meaningful fix is per-pair feedback (already exists via wrong-flash). Optional: doc comment on the stub to prevent the next person repeating this.

## Kata 5: "Delete account endpoint"
Intent: GDPR-ish.
Fake diff: `DELETE /me` runs `db.delete(users).where(eq(users.id, req.userId))`.
Resembles: [me.ts](../../../apps/api/src/routes/me.ts), [db schema.ts#L28-L47](../../../packages/db/src/schema.ts#L28-L47).
Expected — Blocking: none technically — FKs cascade (`onDelete: "cascade"` on tokens and events). The *real* review: no confirmation/re-auth step (one hijacked access token = irreversible deletion; require password re-entry), and client localStorage/SQLite copies survive — deletion story is incomplete. Important: soft-delete/grace-period discussion. This kata teaches that "works" ≠ "shippable."

## Kata 6: "Speed up content endpoint"
Fake diff: replaces `createReadStream` with `readFileSync` cached in a module-level `Map<string, Buffer>` keyed by filename.
Resembles: [content routes#L19-L37](../../../apps/api/src/routes/content.ts#L19-L37).
Expected — Blocking: unbounded cache keyed by *client-supplied names* (bounded by the regex allowlist, but audio files × versions can still grow; memory). Important: bundles already ship `immutable` cache headers — the CDN/browser is the cache; measure before adding one. Optional: if kept, cap + preload at boot instead.

## Kata 7: "Type-safe API client"
Fake diff: replaces `request<T>` with generated types from a new OpenAPI spec, adds 800 lines of codegen output, hand-written spec file.
Resembles: [web api.ts#L18-L27](../../../apps/web/src/lib/api.ts#L18-L27).
Expected — Important: right instinct (the `T`-is-a-claim problem, see [type contracts](../../02-stack-and-language-mastery/03-type-system-and-contracts.md)), wrong source of truth — a hand-written spec is a *third* copy of the contract (TS types, zod, now OpenAPI). Prefer zod-in-core as the single source; infer both. Blocking: generated code committed without generation script in CI (will drift). Kind framing matters here: the author did real work; redirect, don't reject.

## Kata 8: "Fix streak for travelers"
Fake diff: `applyCompletionDay` takes a tz param and recomputes `lastDay` under the *new* tz on every event.
Resembles: [streak.ts#L30-L37](../../../packages/core/src/streak.ts#L30-L37), [events.ts#L64-L67](../../../packages/core/src/events.ts#L64-L67).
Expected — Blocking: retroactively reinterpreting past day-keys changes historical streaks (a user flying west could lose a day they'd earned); day keys must be computed *once, at event time semantics* — which the current design does by folding with one tz. Important: the actual traveler edge (complete 11pm Manila, land in LA same calendar day) deserves a written product decision, not a silent formula change. Tests required either way ([streak.test.ts](../../../packages/core/src/streak.test.ts) would need new cases).

---

Rubric per kata — Basic: found ≥1 Blocking. Solid: your Blocking/Important split matches, comments quote specifics. Strong: at least one comment proposes a cheaper alternative *and* one names a missing test by file.

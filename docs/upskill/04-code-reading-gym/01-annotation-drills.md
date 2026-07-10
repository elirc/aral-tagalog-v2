# Annotation Drills

For each excerpt: open the anchor, annotate I/O/D/INV/SE/F *before* reading the answer key. Grade with the rubric at the bottom.

## Drill 1 — [`regenerate`](../../../packages/core/src/hearts.ts#L18-L27)
Answer key: I: `HeartsState`, `now` ms. O: new `HeartsState` (input never mutated). D: `MAX_HEARTS`, `HEART_REGEN_MS` only. INV: `0 ≤ hearts ≤ 5`; `updatedAt` advances only by whole intervals unless full. SE: none. F: `now < updatedAt` (clock rewind) → early return, no negative regen — deliberate.

## Drill 2 — [`submitAnswer`](../../../packages/core/src/session.ts#L45-L84)
Key: I: state, answer, matchMistakes. O: `{state', correct, correctAnswer}`. D: `grade`. INV: `queue` holds valid indices; done ⇔ queue empty; solved counts *distinct* exercises (wrong answers re-queue without incrementing). SE: none. F: submit after done → unchanged-state echo (defensive no-op); match_pairs bypasses grading entirely — an asymmetry worth noticing.

## Drill 3 — [`reduceEvents`](../../../packages/core/src/events.ts#L49-L86)
Key: INV: output independent of input order (sort by `occurredAt`); timestamps clamped ≤ now; practice completions don't enter `completedLessonIds` but *do* extend streak and refill a heart. F: two events with identical `occurredAt` → sort is stable-by-insertion, not deterministic across arrays with different original order. **Possible risk** (unproven consequence — hearts arithmetic is commutative for same-ms events in practice). This is drill-worthy precision: you found a theoretical hole *and* bounded its impact.

## Drill 4 — [`requireAuth`](../../../apps/api/src/auth.ts#L36-L50)
Key: I: request headers. O: sets `req.userId` or replies 401 (reply-as-return is Fastify's short-circuit idiom — the handler never runs). D: jose, shared secret. INV: after it passes, `userId` is a verified subject. F: expired token, malformed header, empty sub — all one generic 401 (no oracle for attackers; also no distinction for clients to trigger refresh vs re-login… they treat all 401s as refresh triggers, [web api/progress](../../../apps/web/src/lib/progress.tsx#L97-L106)).

## Drill 5 — [`issueTokens`](../../../apps/api/src/routes/auth.ts#L62-L74)
Key: SE: inserts a refresh row *per issue* — old rows accumulate for login-heavy users until expiry (no cleanup job; minor). INV: response is the only place the raw refresh token ever exists.

## Drill 6 — [web `syncWith`](../../../apps/web/src/lib/progress.tsx#L88-L112)
Key: I: tokens + events. SE: network ×(1–3: sync, refresh, retry), localStorage ×3 keys. INV: outbox cleared **only after** server ack; baseline and outbox updated together. F: refresh fails → throw → caller's `.catch` swallows → silent retention (visible nowhere — observability gap). Note the *pair* of setState+save calls per key — a save-consistency convention held by discipline.

## Drill 7 — [`outboxAdd` + `outboxAll`](../../../apps/mobile/src/lib/storage.ts#L42-L59)
Key: SE: SQLite in transaction. INV: at-most-once insertion per event id (`INSERT OR IGNORE`); read order = (occurred_at, id) — *not* insertion order. F: JSON.parse of a corrupted row throws out of `outboxAll` — no guard here, unlike web's `load()`. Asymmetry between platforms = future head-scratcher.

## Drill 8 — [`compileExercise` translate branch](../../../packages/content/src/compile.ts#L68-L88)
Key: I: authored exercise + id. INV: exactly one direction present (asserted at [L69](../../../packages/content/src/compile.ts#L69)); word bank always contains every answer word (auto-built from answer) — *the grader depends on this invariant living in a different package*. Cross-package invariant with no test asserting it: prime ticket material.

## Drill 9 — [`isLessonUnlocked`](../../../apps/web/src/lib/content.ts#L20-L33)
Key: O: boolean; walks course order; unlocked ⇔ every earlier lesson completed. F: completed lesson later *removed from content* → `done.has` never true → everything after it locks. Content changes can brick progression — a real cross-system failure mode found by pure reading.

## Rubric (per drill)
- **Basic:** I/O correct, one side effect or failure mode found.
- **Solid:** all six letters filled; at least one non-obvious invariant.
- **Strong:** found the item marked as the "asymmetry/risk" in the key *before* reading it, and can propose the cheapest guard (test, type, or assertion) for it.

Do all nine across two sittings max. Track your Basic/Solid/Strong ratio — repeat the module in two weeks and compare.

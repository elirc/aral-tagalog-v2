# Side Effects, Async & Reliability

## Complete side-effect inventory

This app is deliberately side-effect-poor — that's a design feature, and being able to *enumerate* effects is the skill:

| Side effect | Trigger | Where | Reliability mechanism |
| --- | --- | --- | --- |
| DB insert (events) | `/sync` | [sync.ts#L47-L60](../../../apps/api/src/routes/sync.ts#L47-L60) | idempotent via PK conflict-ignore |
| DB writes (users/tokens) | auth routes | [routes/auth.ts](../../../apps/api/src/routes/auth.ts) | unique constraints; rotation fail-closed |
| localStorage writes | every event/baseline change | [web progress.tsx#L33-L36](../../../apps/web/src/lib/progress.tsx#L33-L36) | none (quota errors would throw to caller — investigate) |
| SQLite writes | same, mobile | [storage.ts#L42-L53](../../../apps/mobile/src/lib/storage.ts#L42-L53) | transaction per batch |
| Network: sync push | debounce / foreground / login | [web #L137-L141](../../../apps/web/src/lib/progress.tsx#L137-L141), [mobile #L106-L117](../../../apps/mobile/src/lib/progress.tsx#L106-L117) | retry-on-next-trigger; outbox retained on failure |
| Audio playback / file downloads | UI actions; `cacheAllAudio` | [mobile audio.ts#L16-L47](../../../apps/mobile/src/lib/audio.ts#L16-L47) | fail-silent by design |
| Ads (future) | lesson cadence | [ads.ts](../../../packages/core/src/ads.ts) no-op seam | interface isolation |

No email, no webhooks, no queues, no cron. When an interviewer asks "how would you add X reliably," you extend *this* table — that's the move.

## The reliability concepts, taught from the outbox

- **At-least-once + idempotent receiver = effectively exactly-once.** The client may push the same batch repeatedly (crash before ack, [mobile progress.tsx#L62-L75](../../../apps/mobile/src/lib/progress.tsx#L62-L75)); the server ignores duplicates ([sync.ts#L60](../../../apps/api/src/routes/sync.ts#L60)). Neither side needs exactly-once *delivery* — a thing that basically doesn't exist. This is the transferable sentence.
- **Outbox pattern, client-side edition.** The canonical outbox lives server-side (DB row + relay to a queue); here the *client* is the unreliable producer, so the outbox lives on-device. Same invariant: the effect (server insert) and its trigger record (outbox row) never diverge, because rows are cleared only after ack ([web #L91-L96](../../../apps/web/src/lib/progress.tsx#L91-L96), [mobile #L63-L69](../../../apps/mobile/src/lib/progress.tsx#L63-L69)).
- **Retries & backoff:** retries piggyback on natural triggers (new events, app foreground, login) instead of a timer loop. Simple and battery-friendly; the missing piece is exponential backoff for a hard-down server — every trigger fires a doomed request. Cheap to add; low harm today. Classify, don't panic: *failure visibility* is the real gap (nothing tells the user "unsynced for 3 days") — see [observability](../05-quality-engineering/06-observability-and-operations.md).
- **Compensation:** not needed — no multi-system writes. Know the word for interviews: when two systems must both change and you can't have a transaction, you write the undo (compensating action) for step one in case step two fails.
- **Timeouts:** `fetch` here has none ([web api.ts#L18-L27](../../../apps/web/src/lib/api.ts#L18-L27)) — a hung request holds the store's `syncNow` mutex-by-convention until browser defaults kick in. Possible risk, low likelihood; `AbortSignal.timeout(10_000)` is the one-line fix. Good first ticket.

## Side effects in risky places — audit results

1. **Event emission before feedback render** ([LessonPlayer.tsx#L96-L98](../../../apps/web/src/components/LessonPlayer.tsx#L96-L98)): a heart is spent the instant grading happens. If the tab dies before the user sees "wrong," state is still consistent (event persisted synchronously to localStorage). Verdict: fine, and *why* it's fine is the lesson — persist-then-render beats render-then-persist.
2. **`playAudio` inside grading callback** ([LessonPlayer.tsx#L99](../../../apps/web/src/components/LessonPlayer.tsx#L99)): fire-and-forget media in an event handler — correct placement (user gesture unlocks autoplay policies).
3. **`cacheAllAudio` loops downloads serially** ([mobile audio.ts#L34-L47](../../../apps/mobile/src/lib/audio.ts#L34-L47)): 83+ files one-by-one. Deliberate? Serial is kinder to radios/battery and self-throttles; parallel-with-limit (`p-limit`-style, concurrency 4) would be faster. Neither is wrong — *say the tradeoff*.

## Drill

Add (on paper) "email me my weekly progress." Where does the side effect live, what triggers it, what's the idempotency key, what happens when the email provider is down, and how do you avoid double-sends on retry? Force yourself to reuse this repo's vocabulary: it becomes an outbox row keyed `(userId, weekNumber)` written in the same transaction as… wait, written by what? (There's no server-side scheduler — you'd introduce the repo's first cron. Name that honestly as new infrastructure.)

Self-grade — Strong: you identified that the hard part isn't sending email, it's that this architecture has no server-side clock/scheduler at all, and adding one is the actual design decision.

Interview angle: "How do you guarantee a mutation isn't lost or duplicated with a flaky network?" — outbox + idempotent receiver, with these anchors. → [system design variations](../08-interview-prep/04-system-design-from-this-repo.md).

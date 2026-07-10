# Fake-Code Contrasts

Nine bad-vs-better pairs. Every snippet: `// Illustrative fake code: not from this repo.` Each pair ends with the *real* repo pattern it contrasts with.

## 1. Coupling UI shape to DB shape

```ts
// Illustrative fake code: not from this repo.
// BAD: component renders whatever the table looks like
function ProfileCard({ row }: { row: UsersTableRow }) {
  return <span>{row.password_hash ? "verified" : ""}{row.display_name}</span>;
}
```
```ts
// Illustrative fake code: not from this repo.
// BETTER: an explicit response shape at the boundary
type MeResponse = { user: { id: string; email: string; displayName: string | null } };
```
Real pattern: `/me` hand-builds its response omitting `passwordHash` ([me.ts#L12-L15](../../../apps/api/src/routes/me.ts#L12-L15)). The lesson: `SELECT *`-to-JSON leaks columns you'll add later; contracts are curated, not mirrored.

## 2. Missing per-user filter (IDOR)

```ts
// Illustrative fake code: not from this repo.
// BAD: trusts the body's userId
app.post("/sync", async (req) => {
  const { userId, events } = req.body;      // attacker controls userId
  await db.insert(progressEvents).values(events.map(e => ({ ...e, userId })));
});
```
Better = the real code: `userId: req.userId` from the verified token, id never read from the body ([sync.ts#L52](../../../apps/api/src/routes/sync.ts#L52)). Rule: identity comes from credentials, never from payloads.

## 3. N+1 derive

```ts
// Illustrative fake code: not from this repo.
// BAD: one query per lesson to check completion
for (const lesson of lessons) {
  const done = await db.query("SELECT 1 FROM progress_events WHERE user_id=$1 AND payload->>'lessonId'=$2", [uid, lesson.id]);
}
```
Better = real: fetch the user's events once, reduce in memory ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)). N+1 isn't only an ORM disease — any per-item await against I/O counts.

## 4. Timer-driven regeneration

```ts
// Illustrative fake code: not from this repo.
// BAD: cron mutates hearts every 4h
setInterval(async () => {
  await db.query("UPDATE user_state SET hearts = LEAST(hearts+1,5)");
}, FOUR_HOURS); // drifts, misses offline users, double-runs on 2 instances
```
Better = real: derive from `{hearts, updatedAt}` at read time ([hearts.ts#L18-L27](../../../packages/core/src/hearts.ts#L18-L27)). State that is a function of time should be computed, not ticked.

## 5. Stale cache key / derived-state drift

```ts
// Illustrative fake code: not from this repo.
// BAD: increment a cached total alongside the insert
await insertEvent(ev);
await redis.incrby(`xp:${userId}`, ev.xp);   // crash between = drift forever
```
Better = real: no cached total exists; totals derive from the log ([events.ts#L49-L86](../../../packages/core/src/events.ts#L49-L86)). If you must cache: key it to `lastEventId` so staleness is detectable and rebuild is safe.

## 6. Side effect in an unreliable place

```ts
// Illustrative fake code: not from this repo.
// BAD: emit the completion only after the confetti animation
onAnimationEnd={() => addEvents([completionEvent])}  // user closes tab mid-confetti → progress lost
```
Better = real: event recorded in an effect the moment `session.done` flips, ref-guarded ([LessonPlayer.tsx#L44-L59](../../../apps/web/src/components/LessonPlayer.tsx#L44-L59)); the animation is decoration. Persist facts at the earliest consistent moment; decorate later.

## 7. Swallowed error that owed the caller an answer

```ts
// Illustrative fake code: not from this repo.
// BAD
async function login(email, pw) {
  try { return await api.login(email, pw); } catch {} // returns undefined, UI "nothing happened"
}
```
Better = real: `AuthForm` catches, *sets error state for the user*, and re-enables the button ([AuthForm.tsx#L28-L33](../../../apps/web/src/components/AuthForm.tsx#L28-L33)). Contrast with the *legitimate* swallow in `syncNow` ([progress.tsx#L112-L115](../../../apps/web/src/lib/progress.tsx#L112-L115)) — background work with a retry story may swallow; user-initiated actions never.

## 8. Class hierarchy where a union belongs

```ts
// Illustrative fake code: not from this repo.
// BAD for data: behavior scattered, serialization painful
abstract class Exercise { abstract grade(a: unknown): boolean }
class ChoiceExercise extends Exercise { ... }
```
Better = real: plain-data discriminated union + one `grade()` switching exhaustively ([types.ts#L108-L114](../../../packages/core/src/types.ts#L108-L114), [grading.ts#L35-L61](../../../packages/core/src/grading.ts#L35-L61)). Data that crosses process boundaries (JSON!) wants unions, not classes.

## 9. Casual public-contract change

```ts
// Illustrative fake code: not from this repo.
// BAD: "rename for clarity" on a stored event
type ProgressEvent = { kind: "lesson_completed"; points: number /* was xp */ }
```
Why it burns *here specifically*: old events with `xp` live in Postgres jsonb, web localStorage, and mobile SQLite forever; old app versions keep emitting them. The reducer would silently read `undefined`. Better: additive field + reducer reads both + eventual backfill. Real anchor for the stakes: [events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31) is consumed in three storage systems.

---

Drill: for each pair, name the general principle in ≤6 words (e.g., #2 "identity from credentials, not payloads"). Strong = your six-word versions would survive as review comments verbatim.

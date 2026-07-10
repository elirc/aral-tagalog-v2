# Writing Tests Here — 8 recipes

Concrete recipes using this repo's actual tools. Recipes 1–3 work today; 4–8 require the small harness described in recipe 4 (itself a curriculum ticket). Commands are exact.

## Recipe 1: Unit test a grading rule (works now)

Add to [grading.test.ts](../../../packages/core/src/grading.test.ts):

```ts
// Real pattern — mirrors existing tests in this file.
it("ignores double spaces between words", () => {
  expect(normalizeAnswer("kumusta  ka")).toBe("kumusta ka");
});
```

Run targeted: `pnpm --filter @aral/core test -- grading` (vitest filters by filename substring). Watch mode while developing: `pnpm --filter @aral/core test:watch`.

## Recipe 2: Unit test a session edge (works now)

The engine has an untested edge — submitting when hearts/queue interplay ends a lesson mid-retry. Write it:

```ts
// New test for packages/core/src/session.test.ts
it("keeps a wrong exercise in the queue until answered correctly", () => {
  let s = startSession(lesson);
  ({ state: s } = submitAnswer(s, "no"));   // wrong → requeued
  ({ state: s } = submitAnswer(s, "oo"));   // solve #2
  ({ state: s } = submitAnswer(s, "no"));   // wrong again on retry
  expect(s.queue).toHaveLength(1);
  expect(s.mistakes).toBe(2);
});
```

Style rules it follows (copy them): builds its own state; asserts observable outcomes (`queue`, `mistakes`), not internals; uses the file's existing `lesson` fixture.

## Recipe 3: Reducer property test (works now)

For any generated event list, `reduceEvents(shuffle(events))` must equal `reduceEvents(events)`. Sketch with a seeded shuffle (no new deps — copy the [compiler's PRNG](../../../packages/content/src/compile.ts#L31-L47) into the test). This upgrades the existing single-case order test ([events.test.ts#L23-L29](../../../packages/core/src/events.test.ts#L23-L29)) into a property. ~20 lines.

## Recipe 4: API integration harness (the enabling ticket)

Target shape — `apps/api/test/helpers.ts`:

```ts
// Illustrative fake code: not from this repo (proposed harness).
import { buildApp } from "../src/app";
export async function testApp() {
  const app = buildApp({ databaseUrl: process.env.TEST_DATABASE_URL! }); // separate DB, migrated in globalSetup
  await app.ready();
  return app; // use app.inject() — Fastify's built-in request injection, no port needed
}
```

Key facts making this cheap: `buildApp` already accepts a URL ([app.ts#L16-L19](../../../apps/api/src/app.ts#L16-L19)); Fastify ships `app.inject()`; a test DB is one more database in the existing docker Postgres. Isolation strategy: truncate tables between tests (3 tables, trivial) — simpler than transactions here.

## Recipe 5: Happy path + validation failure (register)

```ts
// Illustrative fake code: not from this repo (uses recipe-4 harness).
it("registers then rejects duplicates with 409", async () => {
  const app = await testApp();
  const r1 = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "a@b.co", password: "password1" } });
  expect(r1.statusCode).toBe(201);
  const r2 = await app.inject({ /* same */ });
  expect(r2.statusCode).toBe(409);
});
it("rejects short passwords", async () => { /* expect 400, assert error mentions nothing sensitive */ });
```

## Recipe 6: Permission failure — the missing-auth test

Every protected route must 401 without a token. One table-driven test over `["/sync","/me"]` hitting [requireAuth](../../../apps/api/src/auth.ts#L36-L50). Cheap, catches "forgot the preHandler on a new route" forever — the class of bug that ships silently otherwise. (This repo's version of a cross-tenant test: single-owner scoping means the check is "no token, no data.")

## Recipe 7: Idempotency golden test (the most valuable test this repo doesn't have)

```ts
// Illustrative fake code: not from this repo.
it("replayed sync batches change nothing", async () => {
  const { token } = await registerAndLogin(app);
  const batch = { events: [lessonCompletedEvent()] };
  const first = await syncAs(token, batch);
  const second = await syncAs(token, batch);          // exact replay
  expect(second.json().progress).toEqual(first.json().progress);  // xpTotal identical
});
```

This pins the composite-PK + `onConflictDoNothing` behavior ([sync.ts#L60](../../../apps/api/src/routes/sync.ts#L60), [schema.ts#L57](../../../packages/db/src/schema.ts#L57)) — the system's central promise, currently guarded by nothing but a curl transcript.

## Recipe 8: Web store test without a browser

The web store is React-coupled, but its policy is testable via `@testing-library/react`'s `renderHook` + a localStorage stub — *or*, better, do the [refactor kata](../../06-contribution-practice/04-refactor-and-design-katas.md) first (extract `createProgressStore`) and test it as a pure module with a fake transport: assert "outbox survives failed sync," "baseline adoption clears outbox," "401 triggers exactly one refresh." Lesson: when a test is hard to write, consider whether the *code* is mislocated before reaching for heavier tooling.

## Command reference

```bash
pnpm test                                   # all workspaces with a test script (today: core)
pnpm --filter @aral/core test               # verified
pnpm --filter @aral/core test -- hearts     # single file pattern
pnpm --filter @aral/core test:watch         # TDD loop
pnpm content:build                          # content "tests" (schema validation) — verified
pnpm -r typecheck                           # static layer — verified
```

Drill: implement recipes 2 and 3 for real (they need no harness), run them, and note how long each took. Solid: <30 min total, green. Strong: recipe 3 found you thinking about what "equal" means for `hearts.updatedAt` across orderings — write down your answer.

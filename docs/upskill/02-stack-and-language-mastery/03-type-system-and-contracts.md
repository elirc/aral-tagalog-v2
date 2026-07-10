# Type System & Contracts

**Model:** TypeScript types are compile-time promises between modules; they erase at runtime. So every *trust boundary* (network, storage, files, user input) needs a runtime validator, and the honest architecture is: zod (or similar) at the edges, plain types inside. This repo demonstrates both halves.

## Discriminated unions as the domain backbone

The `Exercise` union ([types.ts#L108-L114](../../../packages/core/src/types.ts#L108-L114)) is discriminated on `type`. Every consumer switches on it and TS *narrows*:

- [grade()](../../../packages/core/src/grading.ts#L35-L61) — `switch (exercise.type)`; inside `case "choice"` TS knows `distractors` exists. No casts.
- [LessonPlayer.tsx#L123-L136](../../../apps/web/src/components/LessonPlayer.tsx#L123-L136) — the same narrowing picks a component per variant.
- Exhaustiveness: if you add a `"speaking"` exercise type, every switch missing a case fails to compile (in `grade` via the return-type check). This is the *point* of unions over class hierarchies for data: adding a variant produces a to-do list from the compiler.

The event union works the same way ([events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31)), and the reducer's `switch` ([L64-L77](../../../packages/core/src/events.ts#L64-L77)) is the exhaustive consumer.

## Runtime validation at every boundary — map it

| Boundary | Validator | Anchor |
| --- | --- | --- |
| HTTP request bodies | zod per route | [sync.ts#L8-L33](../../../apps/api/src/routes/sync.ts#L8-L33), [auth routes#L7-L12](../../../apps/api/src/routes/auth.ts#L7-L12) |
| Authored YAML | zod strict schemas | [content schema.ts](../../../packages/content/src/schema.ts) — `.strict()` rejects typo'd keys |
| localStorage | `try { JSON.parse }` + trust | [web progress.tsx#L23-L31](../../../apps/web/src/lib/progress.tsx#L23-L31) — parsed but **not schema-validated**; a hand-edited outbox entry reaches the reducer typed as `ProgressEvent` while being garbage. Possible risk: client-side only, self-inflicted — but worth knowing it's a hole. |
| SQLite payloads (mobile) | same pattern | [storage.ts#L55-L59](../../../apps/mobile/src/lib/storage.ts#L55-L59) |
| Server → client responses | trusted (typed by hand) | [web api.ts#L18-L28](../../../apps/web/src/lib/api.ts#L18-L28) `request<T>` casts `res.json()` — the classic "generics are not validation" trap: `T` is a *claim*, not a check. |

That last row is the interview gold: `request<T>(...): Promise<T>` looks safe and validates nothing. Mid-level answer: fine when you own both ends and versions deploy together. Senior answer: becomes untrue with mobile clients (old app, new API) — which this repo *has*; response-shape drift would surface as weird runtime states, not clear errors. Mitigation: zod-parse responses or generate types from a single schema source.

## Type/validator duplication — a real drift risk here

`ProgressEvent` is defined twice: as TS types in core ([events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31)) and as zod schemas in the API ([sync.ts#L8-L32](../../../apps/api/src/routes/sync.ts#L8-L32)). They agree today by discipline only. Alternatives: define zod in core and `z.infer` the types (single source), or codegen. Ticket material — and a great "what would you improve" interview answer because the fix is concrete and cheap.

## Idioms used here worth owning

- `satisfies`-free repo; narrowing via unions + `in` guards (`"sentenceId" in ex` pattern doesn't appear here, but `Extract<...>` does in tests). Know both.
- `unknown` at parse edges, e.g. zod `safeParse(req.body)` where body arrives as `unknown` — never `any`. Grep check: `rg "\bany\b" packages apps --type ts` returns only a handful of hits, none in core logic (verified 2026-07-09; the notable one is `bundleJson as unknown as CourseBundle` at [web content.ts#L9](../../../apps/web/src/lib/content.ts#L9), a deliberate build-time cast — JSON import types would be a huge literal type otherwise).
- `Pick<Lesson, "xp">` parameter typing ([xp.ts#L6](../../../packages/core/src/xp.ts#L6)) — ask for the least you need; makes tests trivial.
- `noUncheckedIndexedAccess` shaping code: `s.queue[0]` is `number | undefined`, forcing the explicit guard at [session.ts#L36-L38](../../../packages/core/src/session.ts#L36-L38). Strictness produced a *better API* (`currentExercise` returns `null` honestly).

## Drills

1. Add a fictional `"speaking"` member to the `Exercise` union locally and run `pnpm --filter @aral/core typecheck`. List every error site. Revert. (This is the compiler-as-todo-list demo.)
2. Write (on paper) the zod schema that would validate `UserProgress` coming back from `/me`, then compare with the TS interface ([events.ts#L33-L39](../../../packages/core/src/events.ts#L33-L39)).
3. Find the one place a bad localStorage value could throw *past* the try/catch. (Hint: `load` catches JSON errors, but a valid-JSON wrong-shape value flows on.)

Self-grade — Strong: you can articulate "types are promises, validators are checks, boundaries need checks" with three anchors from this repo in under a minute.

## Interview angle

- "`unknown` vs `any`?" → zod edge parsing here. → [Q-cards](../08-interview-prep/01-js-ts-node-deep-dive.md)
- "How do you keep client/server types in sync?" → the duplication risk above + single-source fix.
- "What does a discriminated union buy you?" → exhaustive switches over exercise/event variants.
- "Where do you validate?" → the boundary table, verbatim.

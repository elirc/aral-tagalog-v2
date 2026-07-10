# System Map

## Shape: pnpm monorepo, apps + packages

```
                 ┌────────────────────────────────────────────┐
                 │              packages/core                  │
                 │  pure TS: types, grading, session machine,  │
                 │  hearts/streak/xp, reduceEvents, ads seam   │
                 └────────▲──────────▲──────────▲──────────────┘
                          │          │          │
      ┌───────────────────┴──┐  ┌────┴─────┐  ┌─┴──────────────┐
      │ apps/web (Next.js)   │  │ apps/api │  │ apps/mobile     │
      │ localStorage outbox  │  │ Fastify  │  │ Expo + SQLite   │
      └──────────▲───────────┘  │ Postgres │  │ outbox          │
                 │              └────▲─────┘  └───────▲─────────┘
                 │   HTTP /sync /auth /content │ HTTP  │
                 └─────────────────────────────┴───────┘
   packages/content: YAML ──compile──► dist/bundle JSON ──► served by api,
                                       imported at build-time by web,
                                       shipped in the mobile binary
   packages/db: Drizzle schema + migrations (used only by api)
   packages/ui: design tokens only (colors/spacing) — no components
```

- Dependency direction is one-way: apps depend on packages; packages never import apps; `core` imports nothing but itself. Check any core file's imports (e.g. [session.ts#L1-L2](../../../packages/core/src/session.ts#L1-L2)) — only sibling modules. That is a **boundary**: a line where dependencies are only allowed to point one way. Interviewers probe boundaries constantly ("where would business logic live?").

## Ownership map

| Area | Owner directory | Key entry points |
| --- | --- | --- |
| Domain/game logic | [packages/core/src](../../../packages/core/src) | [index.ts](../../../packages/core/src/index.ts) re-exports everything |
| Content pipeline | [packages/content](../../../packages/content) | [compile.ts](../../../packages/content/src/compile.ts), YAML under `course/en-tl/` |
| Persistence schema | [packages/db/src/schema.ts](../../../packages/db/src/schema.ts) | 3 tables + migrations dir |
| HTTP API | [apps/api/src](../../../apps/api/src) | [app.ts](../../../apps/api/src/app.ts#L16-L28) wires routes |
| Web UI | [apps/web/src](../../../apps/web/src) | `app/` routes, `lib/progress.tsx` store |
| Mobile UI | [apps/mobile](../../../apps/mobile) | `app/` (expo-router), `src/lib/` |
| Design tokens | [packages/ui/src/index.ts](../../../packages/ui/src/index.ts) | consumed by mobile styles; mirrored in web CSS |
| Tests | co-located `*.test.ts` in core only | run via `pnpm test` |

## Public interfaces vs private internals

**Public (a contract — changing it breaks someone else):**
- REST surface: `POST /auth/register|login|refresh`, `GET /content/courses/:id/manifest`, `GET /content/bundles/:name`, `GET /content/audio/:file`, `POST /sync`, `GET|PATCH /me` — all registered in [app.ts#L21-L26](../../../apps/api/src/app.ts#L21-L26).
- The `ProgressEvent` union ([events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31)) — serialized into client storage **and** the DB (`payload` jsonb). This is the least obvious and most dangerous contract in the repo: old events live forever, so every change must be backward-compatible.
- The `CourseBundle` JSON shape ([types.ts#L8-L20](../../../packages/core/src/types.ts#L8-L20)) — downloaded by mobile, imported by web.

**Private (safe to refactor):** component internals, route handler bodies, the compiler's internals (as long as output shape holds), CSS.

Senior noticing: the repo has *three* persistence surfaces for the same events — Postgres `progress_events`, web localStorage, mobile SQLite — and one shared reducer keeping them semantically identical. The reducer ([reduceEvents](../../../packages/core/src/events.ts#L49-L86)) is therefore the highest-blast-radius function in the codebase: a bug there corrupts state everywhere at once. **Blast radius** = how much of the system a change can break; interviewers love candidates who rank code by it.

## Drill

Without opening more files: which package would you edit to (a) change perfect-lesson bonus XP, (b) add a `DELETE /me` endpoint, (c) fix a typo in a lesson, (d) change heart regen to 3 hours? Then verify: (a) [xp.ts#L4](../../../packages/core/src/xp.ts#L4), (b) `apps/api/src/routes/me.ts`, (c) `packages/content/course/en-tl/units/`, (d) [hearts.ts#L2](../../../packages/core/src/hearts.ts#L2).

Self-grade — Basic: 2/4 right. Solid: 4/4. Strong: you also noted (d) silently changes offline clients' behavior only after they update the app, so old and new clients would briefly disagree about regen — a versioning smell worth an interview mention.

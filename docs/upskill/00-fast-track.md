# Fast Track — one weekend

Goal: by Sunday night you can run the stack, trace two end-to-end flows, make one safe change, and explain the architecture aloud for 90 seconds.

## 1. Install and run (Saturday morning)

All commands from repo root. *Verified* = executed successfully during curriculum authoring (2026-07-09); *inferred* = read from scripts but not run here.

```bash
pnpm install                 # verified
pnpm content:build           # verified — compiles YAML course → packages/content/dist
docker compose up -d         # verified — Postgres on localhost:5433 (5432 avoided deliberately)
pnpm db:migrate              # verified — drizzle-kit applies packages/db/migrations
pnpm api:dev                 # verified — Fastify on :3001
pnpm web:dev                 # verified — Next.js on :3000
pnpm mobile:start            # inferred — Expo dev server; needs a device/emulator
pnpm test                    # verified — 27 vitest tests in packages/core
```

Order matters: `content:build` must run before web/mobile bundling because both import the compiled bundle from `packages/content/dist` (gitignored). See [web/src/lib/content.ts](../../apps/web/src/lib/content.ts#L2-L9).

## 2. First 10 files, in this order

| # | File | Why |
| --- | --- | --- |
| 1 | [README.md](../../README.md) | Architecture summary + deliberate simplifications |
| 2 | [package.json](../../package.json) | Workspace scripts — the verbs of this repo |
| 3 | [packages/core/src/types.ts](../../packages/core/src/types.ts#L8-L115) | The whole domain model in one file |
| 4 | [packages/core/src/events.ts](../../packages/core/src/events.ts#L13-L86) | The event log — the repo's central idea |
| 5 | [packages/core/src/session.ts](../../packages/core/src/session.ts#L25-L84) | Lesson state machine (pure, no React) |
| 6 | [packages/db/src/schema.ts](../../packages/db/src/schema.ts#L14-L59) | Three tables; notice what's *not* stored |
| 7 | [apps/api/src/routes/sync.ts](../../apps/api/src/routes/sync.ts#L40-L67) | The only write path for progress |
| 8 | [apps/web/src/lib/progress.tsx](../../apps/web/src/lib/progress.tsx#L21-L124) | Client store: outbox + baseline overlay |
| 9 | [apps/web/src/components/LessonPlayer.tsx](../../apps/web/src/components/LessonPlayer.tsx#L33-L120) | Where UI meets the core engine |
| 10 | [packages/content/src/compile.ts](../../packages/content/src/compile.ts#L63-L127) | Authoring format → runtime format |

## 3. Trace two flows

Do these with the code open, filling a scrap trace table (step → file → data shape). Full versions in [key flows](01-codebase-cartography/05-key-flows.md).

1. **Answer an exercise (web):** click a word chip in `TapsView` → `LessonPlayer.check()` → `submitAnswer()` in core → wrong answers append a `hearts_lost` event. Start at [LessonPlayer.tsx#L93](../../apps/web/src/components/LessonPlayer.tsx#L93-L101).
2. **Sync progress:** `addEvents` writes localStorage outbox → debounced effect → `POST /sync` → server inserts with `onConflictDoNothing` → response becomes the new client baseline. Start at [progress.tsx#L80](../../apps/web/src/lib/progress.tsx#L80-L124), then [sync.ts#L41](../../apps/api/src/routes/sync.ts#L41-L66).

## 4. One small safe change

Add a new accepted alternate answer to one exercise: in [01-greetings.yaml](../../packages/content/course/en-tl/units/01-greetings.yaml), find the `Mabuti ako.` translate exercise and add an entry to `accept:`. Then `pnpm content:build` and replay the lesson at `http://localhost:3000/lesson/greetings-4`. Zero product-code changes, full pipeline exercised.

## 5. One test to run and one to read

```bash
pnpm --filter @aral/core test          # verified: 27 pass
```

Read [events.test.ts](../../packages/core/src/events.test.ts#L23-L29) ("is order-independent") and answer: *why must event reduction be order-independent in this system?* (Answer: offline batches from multiple devices arrive late and interleaved; state must converge regardless — this is the consistency story of the whole app.)

## 6. Teach-back (the interview rep)

Say aloud, 90 seconds, no notes: *"Aral stores user progress as an append-only event log. Clients derive all state locally from events, so guest mode and offline play are free. Sync is one idempotent batch endpoint; the server folds the same events with the same shared function. The tradeoff is that derived state must be recomputable and event schemas become a public contract."* Then answer your own follow-up: what breaks if a client clock is wrong? (See [reduceEvents clamp](../../packages/core/src/events.ts#L61-L63).)

## What the fast track skips

Mobile (SQLite outbox, bundle hot-swap), auth token rotation, the content compiler internals, testing strategy, and everything about *why alternatives were rejected*. That's the rest of the curriculum.

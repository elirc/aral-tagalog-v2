# Aral — Learn Tagalog

A free Duolingo-style app teaching **Tagalog to English speakers**. Web (Next.js) +
mobile (Expo) clients share all game logic through a pnpm/Turborepo monorepo;
the backend is Fastify + PostgreSQL. Built to the spec in `SPEC.md` with a few
documented simplifications (see below).

## Layout

```
apps/
  api/       Fastify REST API — auth, /sync, content serving
  web/       Next.js app — course map, lesson player, guest mode + accounts
  mobile/    Expo app — same features, offline-first with SQLite outbox
packages/
  core/      Pure-TS game engine: exercise types, grading, session state
             machine, hearts/streak/XP, progress-event reducer (unit tested)
  content/   YAML course sources + Zod-validated compiler → versioned JSON bundle
  db/        Drizzle schema + migrations (users, refresh_tokens, progress_events)
  ui/        Shared design tokens (colors/spacing/radii)
  config/    Shared tsconfig
```

## Quickstart

```sh
pnpm install
pnpm content:build            # compile YAML → packages/content/dist (required once)

# backend (needs Docker, or point DATABASE_URL at any Postgres)
docker compose up -d          # Postgres on localhost:5433
pnpm db:migrate
pnpm api:dev                  # http://localhost:3001

# web
pnpm web:dev                  # http://localhost:3000

# mobile (Expo Go or dev build)
pnpm mobile:start
```

The web and mobile apps are fully playable **without an account or backend**
(guest mode, progress on device). Register/login to sync progress via the API.

```sh
pnpm test        # unit suites: core engine, API validation, content validators
pnpm typecheck   # all packages
pnpm build       # turbo: content bundle + ui tokens + web build
pnpm smoke       # end-to-end checks against the RUNNING stack (db + api:dev)
```

`docs/TESTING.md` explains what every test guards and why it exists.

## How the pieces fit

- **Content pipeline:** author YAML in `packages/content/course/en-tl/`, run
  `pnpm content:build`. Zod validates, the compiler emits an immutable
  versioned bundle (`course_en_tl_v1.json`) + audio manifest. Web imports the
  bundle at build time; mobile ships it in the binary and hot-swaps newer
  versions downloaded from the API. See `packages/content/README.md`.
- **Progress = events:** every lesson completion / heart change is an
  append-only `ProgressEvent` with a client-generated UUID. Clients reduce
  events locally (`reduceEvents` in core); `/sync` inserts them idempotently
  and returns server-derived progress as the new client baseline. This is what
  makes offline sync conflict-free (OFF-03): replays are no-ops, streaks use
  device timestamps, hearts replay with regeneration.
- **Hearts:** 5 max, −1 per mistake, +1 per 4h (computed from timestamps, works
  offline), refill by practicing a completed lesson (practice runs are
  heart-free). Ads hooks exist behind `AdsProvider` in core; v1 ships a no-op.
- **Streaks:** local-midnight rollover using the device IANA timezone.

## Deliberate simplifications vs. the spec

- **No content tables in Postgres.** Bundles are immutable versioned files;
  the API serves them straight from `packages/content/dist`. The DB only holds
  users + progress events. Content tables can be added later without touching
  clients (they only see bundles).
- **Single `progress_events` table** instead of `xp_events` +
  `lesson_completions` + `user_state` — same event-sourced idea (DAT-02), less
  schema. Derived state is computed by the shared reducer; a cache table can
  be added if `/me` ever gets slow.
- **Web ships the bundle at build time** rather than downloading it (content
  updates ride deploys). Mobile does runtime download/versioning per OFF-04.
- **Audio files aren't recorded yet.** Every exercise/vocab entry has an
  `audio_ref`; players fail silently when a clip is missing. Record clips into
  `packages/content/audio/en-tl/<ref>.mp3`, or generate with Piper via
  `packages/content/scripts/generate-audio.mjs` (AUD-02).
- **Ads are a no-op provider** (GAM-04 seam is in place; AdMob lands in M5).

## Course content status

18 units, 69 lessons, 584 exercises (greetings through hobbies). All five
exercise types are exercised, including `ng`/`nang` and hyphen-tolerance
grading (CNT-04), and the compiler rejects unsolvable or ambiguous exercises
at build time. Content is a starter draft — review by a fluent speaker
recommended.

## Deploying (near-zero cost)

- **API:** Fly.io/Railway free tier; copy `apps/api/.env.example` and set
  `DATABASE_URL` (Neon/Supabase free Postgres), `JWT_SECRET`, and
  `CORS_ORIGIN`. Run `pnpm db:migrate` on deploy. The server binds
  `0.0.0.0:3001` by default, shuts down gracefully on SIGTERM, and never
  leaks internal error details in responses. It reads the compiled lesson
  catalog **once at startup** (that's what caps claimed XP), so restart the
  API whenever you ship new content — otherwise new lessons fall back to the
  catalog-wide max instead of their authored value.
- **Web:** Vercel; set `NEXT_PUBLIC_API_URL`.
- **Mobile:** EAS builds; set `extra.apiUrl` in `app.json` to the deployed API.
- **Post-deploy check:** `SMOKE_API_URL=https://your-api pnpm smoke` runs the
  29-check end-to-end suite (registers a throwaway user; safe on prod data,
  but it does write one test account).

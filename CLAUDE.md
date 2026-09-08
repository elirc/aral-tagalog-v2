# Aral monorepo notes

- pnpm workspaces + Turborepo. Node 24 LTS. `pnpm install` at root.
- Build order matters once: `pnpm content:build` must run before web/mobile
  bundling (they import `@aral/content/bundle` from `packages/content/dist`,
  which is gitignored). Same for `@aral/ui` — its build generates
  `dist/tokens.css` (the web app's color variables; single source of truth in
  `packages/ui/src/index.ts`). Turbo handles both for `pnpm build`.
- All game logic lives in `packages/core` (pure TS, no platform deps) — add
  features there first, with vitest tests (`pnpm test`), then wire UI per app.
  `@aral/api` and `@aral/content` have vitest suites too; see
  `docs/TESTING.md` for what each test guards before changing one.
- Daily quests and combo XP are **derived, not stored**, the same way
  achievements are: `reduceEvents` keeps per-day counters (`dayStats`), checks
  the day's quest targets after every completion, and credits the reward
  itself. There is no claim endpoint and no claim event to forge — server and
  clients run the same reducer. Quest targets read `dayStats.lessonXp` only,
  never `questXp`, so a reward can never complete the quest that paid it.
- Progress is event-sourced: clients append `ProgressEvent`s (UUID ids),
  `/sync` is the only write path, `reduceEvents` derives state on both sides.
  Don't add direct state-mutation endpoints.
- Content: YAML in `packages/content/course/en-tl/`, schema in
  `src/schema.ts`. Bump `version` in `course.yaml` when editing published
  content. Most units are **generated** — `pnpm content:generate` appends to
  every `units/18t-g*|35r-g*|51q-g*|57g-g*.yaml` from `packages/content/
  generator/` (lexicon + grammar focuses). Edit the generator, not those
  files; hand-authored units are left alone. Units are grouped into ordered **difficulty tiers** declared in
  `course.yaml`; each unit names one with `tier:` and a tier's units must stay
  contiguous (the compiler enforces both). Unlocking is scoped to a tier, so a
  learner can place into a later one instead of starting at unit 1.
- Local Postgres: `docker compose up -d` → localhost:5433 (5432 is taken on
  this machine). Migrations: `pnpm db:migrate` (drizzle-kit).
- Web dev expects the API on localhost:3001 (`NEXT_PUBLIC_API_URL` to change).
- `@types/react` is pinned via root pnpm override to keep web and Expo on the
  same version — don't add per-app versions.
- The repo lives inside OneDrive. If a build dies with
  `EINVAL: invalid argument, readlink ... .next\...`, OneDrive dehydrated
  gitignored build output to a cloud placeholder — delete the dir, rebuild,
  and re-pin with `attrib +P <dir> /s /d` ("always keep on this device").
  The tree was pinned 2026-08-01; new gitignored dirs inherit from their
  parent, but a OneDrive reset can undo it.
- End-to-end checks: `pnpm smoke` against a running stack
  (`docker compose up -d && pnpm db:migrate && pnpm api:dev`). Registers a
  throwaway user; 39 checks over readiness, auth rotation, sync clamping, review queue,
  tier placement, and combo bounding.

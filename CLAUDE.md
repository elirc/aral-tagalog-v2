# Aral monorepo notes

- pnpm workspaces + Turborepo. Node ≥20. `pnpm install` at root.
- Build order matters once: `pnpm content:build` must run before web/mobile
  bundling (they import `@aral/content/bundle` from `packages/content/dist`,
  which is gitignored). Same for `@aral/ui` — its build generates
  `dist/tokens.css` (the web app's color variables; single source of truth in
  `packages/ui/src/index.ts`). Turbo handles both for `pnpm build`.
- All game logic lives in `packages/core` (pure TS, no platform deps) — add
  features there first, with vitest tests (`pnpm test`), then wire UI per app.
  `@aral/api` and `@aral/content` have vitest suites too; see
  `docs/TESTING.md` for what each test guards before changing one.
- Progress is event-sourced: clients append `ProgressEvent`s (UUID ids),
  `/sync` is the only write path, `reduceEvents` derives state on both sides.
  Don't add direct state-mutation endpoints.
- Content: YAML in `packages/content/course/en-tl/`, schema in
  `src/schema.ts`. Bump `version` in `course.yaml` when editing published
  content.
- Local Postgres: `docker compose up -d` → localhost:5433 (5432 is taken on
  this machine). Migrations: `pnpm db:migrate` (drizzle-kit).
- Web dev expects the API on localhost:3001 (`NEXT_PUBLIC_API_URL` to change).
- `@types/react` is pinned via root pnpm override to keep web and Expo on the
  same version — don't add per-app versions.

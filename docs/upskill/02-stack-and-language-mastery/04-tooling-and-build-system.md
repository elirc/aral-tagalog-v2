# Tooling & Build System

**Model:** a monorepo build is a directed graph of tasks over a graph of packages. Every mystery failure is one of: wrong graph edge, stale artifact, or duplicate dependency. Learn to ask *which of the three* before touching config.

## The graphs in this repo

- **Package graph:** apps → `@aral/core`/`@aral/content`/`@aral/db`/`@aral/ui` via `workspace:*` ranges (see [apps/web/package.json](../../../apps/web/package.json)). pnpm symlinks workspace packages into `node_modules/@aral/*`.
- **Task graph:** [turbo.json](../../../turbo.json) — `build.dependsOn: ["^build"]` means "my dependencies' build runs first." The only meaningful producer is `@aral/content` (its `build` runs the compiler); web's build therefore always finds `dist/course_en_tl.json`.
- **Escape hatch to know:** `pnpm --filter <pkg> <script>` runs one package without turbo — which also *skips* dependency builds. That's why a fresh clone doing `pnpm web:dev` without `pnpm content:build` fails: dev scripts aren't in the graph. Documented in [CLAUDE.md](../../../CLAUDE.md); root cause is a general lesson — *dev servers rarely participate in build graphs.*

## Three real incidents from this repo's own history (all generalizable)

1. **Duplicate `@types/react`** — web resolved 19.2.x while Expo pinned ~19.0.10; two copies of React's types made `ReactNode` structurally incompatible across packages ("Property 'children' is missing in type…"). Fix: a root pnpm override pinning one version ([package.json#L24-L28](../../../package.json#L24-L28)). Transferable diagnostic: type errors mentioning two identical-looking types = duplicate types package; check `pnpm why @types/react`.
2. **Raw-TS workspace packages** — `@aral/core` ships `src/index.ts` as its main ([core package.json#L6](../../../packages/core/package.json#L6)). Consumers must transpile: Next via `transpilePackages` ([next.config.mjs](../../../apps/web/next.config.mjs)), Metro via `watchFolders` ([metro.config.js](../../../apps/mobile/metro.config.js)). If you see "Unexpected token 'export'" from a workspace import, this contract broke.
3. **Port collision** — Postgres maps to **5433** ([docker-compose.yml](../../../docker-compose.yml)) because 5432 was occupied on the dev machine; three files carry the default URL ([drizzle.config.ts](../../../packages/db/drizzle.config.ts), [env.ts#L9](../../../apps/api/src/env.ts#L9), [.env.example](../../../apps/api/.env.example)). Config duplication = drift risk; a senior centralizes or documents loudly (here: documented in CLAUDE.md).

## Migrations tooling

`drizzle-kit generate` diffs [schema.ts](../../../packages/db/src/schema.ts) against `migrations/` and emits SQL; `drizzle-kit migrate` applies. The generated [0000_mixed_toad.sql](../../../packages/db/migrations/0000_mixed_toad.sql) is committed — migrations are code, reviewed like code. Rule: never edit an applied migration; add a new one (append-only, like the event log — same principle, different layer).

## Drills

1. Run `pnpm build` twice; the second is near-instant. Explain from turbo's cache model what got cached and what key invalidates it (file hashes of inputs). Then `pnpm content:build` after touching a YAML — why does *web* rebuild on next `pnpm build`?
2. `pnpm why zod` — how many consumers? What would a zod v4 major bump require checking? (Every boundary schema; content compiler error formats.)
3. Break it on purpose: rename `packages/content/dist` and run `pnpm --filter @aral/web build`. Read the error and map it back to the graph concept. Restore with `pnpm content:build`.

Self-grade — Strong: for any build failure you can classify it as graph-edge / stale-artifact / duplicate-dep within two minutes and name the command that proves it.

## Interview angle

- "Tell me about a gnarly build/tooling issue" → incident 1 (duplicate types) is a complete STAR story: symptom, diagnosis method, fix, prevention. → [behavioral stories](../08-interview-prep/06-behavioral-star-stories.md)
- "Monorepo vs polyrepo?" → answer with the shared-core payoff ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) reusing the client reducer) *and* the costs you personally hit (transpilation config, type duplication).
- "How do database migrations fit CI/CD?" → generate-diff-commit-apply flow here, plus append-only rule.

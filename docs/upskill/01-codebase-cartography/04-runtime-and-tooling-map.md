# Runtime & Tooling Map

## Toolchain

| Tool | Where configured | Role |
| --- | --- | --- |
| pnpm workspaces | [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) | one lockfile, cross-package `workspace:*` links |
| Turborepo | [turbo.json](../../../turbo.json) | task graph: `build` depends on `^build`, so content compiles before web builds |
| TypeScript (strict) | [packages/config/tsconfig.base.json](../../../packages/config/tsconfig.base.json) | `strict` + `noUncheckedIndexedAccess` everywhere — indexing returns `T \| undefined`, which is why you see `!` after bounds-checked access, e.g. [session.ts#L79](../../../packages/core/src/session.ts#L79) |
| Vitest | `packages/core` only | pure-logic tests; no DOM env needed |
| Drizzle Kit | [packages/db/drizzle.config.ts](../../../packages/db/drizzle.config.ts) | SQL migration generation/apply |
| Docker Compose | [docker-compose.yml](../../../docker-compose.yml) | Postgres 16 on **host port 5433** (deliberate: 5432 was taken on the dev machine) |
| tsx | api + content scripts | runs TS directly; no build step for the server |
| Next.js 15 | [apps/web/next.config.mjs](../../../apps/web/next.config.mjs) | `transpilePackages` compiles the raw-TS workspace packages |
| Expo SDK 53 | [apps/mobile/app.json](../../../apps/mobile/app.json), [metro.config.js](../../../apps/mobile/metro.config.js) | monorepo-aware Metro (`watchFolders` = repo root) |

Note the unusual choice: workspace packages export **raw TypeScript** (`"main": "./src/index.ts"`, see [core package.json](../../../packages/core/package.json)) and consumers transpile it. Cost: every consumer needs TS-aware bundling (hence `transpilePackages`, Metro config). Benefit: zero build/watch step for shared code during dev. Alternative: compile packages to `dist/` — safer for publishing, slower for a solo dev. Interview-worthy tradeoff.

## Runtime boundaries

| Surface | Runtime | State it may touch |
| --- | --- | --- |
| `packages/core` | *any* (isomorphic) | none — pure functions; `Date.now()` is passed in, not called (see [reduceEvents signature](../../../packages/core/src/events.ts#L49-L55)) |
| `apps/api` | Node 20+ | Postgres, content files on disk |
| `apps/web` | browser (all pages are `"use client"`) + Node for SSR shell | localStorage, fetch |
| `apps/mobile` | Hermes (React Native) | SQLite, filesystem, fetch |

Sharp edge: core must stay platform-free. Adding `window` or `fs` to `packages/core` breaks mobile or the API respectively — and nothing but discipline currently enforces that (possible lint rule; see tickets).

## Env vars (high level, no secrets)

| Var | Consumer | Default | Note |
| --- | --- | --- | --- |
| `DATABASE_URL` | api | local docker on 5433 | [env.ts#L9](../../../apps/api/src/env.ts#L9) |
| `JWT_SECRET` | api | dev value; **boot-fails in production** if unchanged | [env.ts#L10,L18-L20](../../../apps/api/src/env.ts#L18-L20) — a small but senior touch |
| `PORT` | api | 3001 | |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:3001` | [web api.ts](../../../apps/web/src/lib/api.ts#L4) |
| `expo.extra.apiUrl` | mobile | localhost | [app.json](../../../apps/mobile/app.json) — note: localhost on a device points at the *device*; real devices need the LAN IP (classic mobile-dev gotcha) |

## Commands

See [command cheatsheet](../09-reference/command-cheatsheet.md) for the full verified list.

Drill: run `pnpm build` from a clean checkout and explain, from [turbo.json](../../../turbo.json), why content compiles before web without any explicit ordering in the script. Solid: you cite `dependsOn: ["^build"]` + the web→content dependency edge in `apps/web/package.json`. Strong: you explain what breaks if `packages/content/dist` is deleted and only `pnpm web:dev` (not `build`) is run — dev bypasses turbo's graph.

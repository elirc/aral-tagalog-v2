# Command Cheatsheet

All from repo root unless noted. **verified** = executed during authoring (2026-07-09); *inferred* = read from scripts, not run here.

| Task | Command | Status |
| --- | --- | --- |
| Install | `pnpm install` | verified |
| Compile course content | `pnpm content:build` | verified — required before web/mobile bundling |
| Start Postgres | `docker compose up -d` | verified — host port **5433** |
| Stop Postgres | `docker compose down` (add `-v` to wipe data) | inferred |
| Generate migration from schema | `pnpm --filter @aral/db generate` | verified |
| Apply migrations | `pnpm db:migrate` | verified |
| API dev (watch) | `pnpm api:dev` → :3001 | verified |
| Web dev | `pnpm web:dev` → :3000 | verified |
| Mobile dev server | `pnpm mobile:start` | inferred (needs device/emulator) |
| All tests | `pnpm test` | verified (27 pass, core only) |
| One package's tests | `pnpm --filter @aral/core test` | verified |
| Single test file | `pnpm --filter @aral/core test -- hearts` | verified pattern |
| Watch mode | `pnpm --filter @aral/core test:watch` | inferred |
| Typecheck everything | `pnpm -r typecheck` | verified |
| Full build (turbo graph) | `pnpm build` | verified |
| Web prod build only | `pnpm --filter @aral/web build` | verified |
| Generate TTS audio | `node packages/content/scripts/generate-audio.mjs --model <piper.onnx>` | inferred (needs Piper installed) |
| Who depends on X | `pnpm why <pkg>` | verified pattern |
| DB console | `docker exec -it tagalog-db-1 psql -U aral aral` | inferred (container name may vary — check `docker ps`) |

## Smoke-test snippets (verified transcript in [verification log](verification-log.md))

```bash
curl -s localhost:3001/health
curl -s -X POST localhost:3001/auth/register -H "Content-Type: application/json" \
  -d '{"email":"t@e.st","password":"password123","tz":"Asia/Manila"}'
# then: POST /sync with Bearer token; GET /me; GET /content/courses/en-tl/manifest
```

Gotchas: fresh clone → run `content:build` before anything web/mobile; changing `packages/db/src/schema.ts` without generate+migrate leaves DB and code disagreeing; mobile on a real device needs the API URL set to your LAN IP, not localhost.

# Verification Log

Running record of what was inspected and executed while writing this curriculum. Maintained during authoring, not reconstructed.

## Environment

- Date: 2026-07-09 (afternoon/evening, local)
- Machine: Windows 11, Node v22.16.0, pnpm 9.12.3, Docker 29.2.1
- Repo state: single commit `bffcb13` ("Initial build: Aral Tagalog learning app monorepo"), clean tree before docs were added.

## Commands executed and results

| Command | Result |
| --- | --- |
| `pnpm install` | ✅ completes (run multiple times during build-out) |
| `pnpm --filter @aral/core test` | ✅ 27 tests pass (5 files) — re-run 2026-07-09 19:34 |
| `pnpm content:build` | ✅ "compiled en-tl v1: 5 units, 17 lessons, 136 exercises, 83 audio refs"; warns all 83 audio refs unrecorded |
| `docker compose up -d` | ✅ Postgres 16 on host port 5433 (5432 occupied on this machine) |
| `pnpm --filter @aral/db generate` / `migrate` | ✅ migration `0000_mixed_toad.sql` generated and applied |
| `pnpm --filter @aral/api start` + curl smoke | ✅ `/health` ok; register → sync (2 events) → replay same batch → `/me`; replay did **not** double-count (accepted=1, xpTotal unchanged) |
| `pnpm --filter @aral/web build` | ✅ Next 15 build, type-checked, 6 routes |
| `pnpm -r typecheck` | ✅ all packages clean (after pinning `@types/react` via root pnpm override) |
| `curl http://localhost:3000/{,lesson/greetings-1,login}` (dev server) | ✅ all 200 |
| `pnpm mobile:start` / device run | ❌ **not executed** — no emulator/device in this environment |

## Anchor verification

All file/line anchors in these docs were harvested with `grep -n` against the working tree on 2026-07-09 immediately before writing (core exports, API routes, web store/player, mobile libs, db schema, compiler). Anchors are start-of-symbol accurate; ranges extend to the end of the cited block as read in the same session.

## Known uncertainties / not covered

- **Mobile runtime behavior is unverified.** `apps/mobile` typechecks but was never executed on a device. Claims about it are code-reading claims, labeled accordingly.
- **No API integration test suite exists** — API behavior claims rest on the manual curl smoke test above plus code reading. (This is itself a curriculum ticket: see [good-first-tickets](../06-contribution-practice/01-good-first-tickets.md).)
- Audio playback paths return 404 for all refs (no clips recorded); players are designed to fail silently — verified by reading [web audio.ts](../../../apps/web/src/lib/audio.ts) / [mobile audio.ts](../../../apps/mobile/src/lib/audio.ts), not by listening.
- `expo-av` deprecation status relative to current Expo SDK not re-verified against upstream docs.
- Argon2 parameter defaults (`@node-rs/argon2`) not benchmarked; assumed library defaults.

## Additions during doc authoring

- 2026-07-09: created `docs/upskill/**` (docs only; no product code touched). Verified `git status` shows only additions under `docs/`.

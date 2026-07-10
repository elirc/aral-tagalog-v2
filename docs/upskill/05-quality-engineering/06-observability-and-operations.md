# Observability & Operations

**The question that organizes this page: "how would I know this broke?"** Asked per flow, answered honestly. Observability = the ability to infer internal state from outputs (logs, metrics, traces). This repo has the minimum; knowing precisely *which* minimum is missing is the skill.

## What exists

- **Structured request logs:** Fastify's pino, enabled at [app.ts#L17](../../../apps/api/src/app.ts#L17) — method, path, status, latency per request, JSON format. That's real observability for free; many CRUD apps ship with less.
- **Health check:** [`GET /health`](../../../apps/api/src/app.ts#L21) — suitable for a load balancer/uptime ping.
- **Fail-fast config guard:** default JWT secret kills prod boot ([env.ts#L18-L20](../../../apps/api/src/env.ts#L18-L20)) — misconfiguration surfaces at deploy, not at incident.
- **Client error surfacing:** auth forms show errors ([AuthForm.tsx#L28-L33](../../../apps/web/src/components/AuthForm.tsx#L28-L33)); Next.js provides a default error boundary.

## What's missing, per flow ("how would I know?")

| Flow | Breakage | Current signal | Cheapest adequate fix |
| --- | --- | --- | --- |
| Sync (web/mobile) | outbox stuck (poison event, server down, 401 loop) | **none** — swallowed at [progress.tsx#L112-L115](../../../apps/web/src/lib/progress.tsx#L112-L115) | client: surface "unsynced changes: N / last sync: t" in Header; server: 4xx/5xx rate on `/sync` in logs |
| Lesson completion | events not recorded (storage full, bug) | none | dev-only console.error in `save()` catch path ([progress.tsx#L33-L36](../../../apps/web/src/lib/progress.tsx#L33-L36) currently has no catch — writes can throw; investigate) |
| Auth | brute-force wave / refresh loops | pino lines exist but nothing aggregates | log-based alert on 401-rate; add `userId` to log context after `requireAuth` |
| Content serving | 404 storms after a bad deploy (missing bundle file) | pino 404 lines | alert on 404-rate for `/content/*`; deploy check: curl manifest post-deploy |
| Audio | all clips failing | *designed* silence ([audio.ts#L8-L14](../../../apps/web/src/lib/audio.ts#L8-L14)) | a counter (even console.count in dev) — fail-silent features need a heartbeat somewhere |
| DB | connection pool exhaustion | request errors in pino | health check that touches the DB (current `/health` doesn't — it returns ok with Postgres down; **verified by reading** [app.ts#L21](../../../apps/api/src/app.ts#L21). Classic gotcha: shallow health checks lie) |

That `/health`-lies observation is interview-grade: shallow vs deep health checks, and why LBs want shallow (fast, no cascading failure) while deploy gates want deep.

## Deploy & rollback story (as-is)

- **API:** stateless process; `tsx src/index.ts`. Rollback = redeploy previous commit. Migrations are forward-only — rollback of code must tolerate the newer schema (additive migrations make that true; the current single migration is additive by definition).
- **Web:** static-ish Next build; per-deploy content snapshot. Rollback trivially safe (older bundle = older content, still consistent).
- **Mobile:** app-store releases — *no rollback*, only roll-forward; this asymmetry is why event/bundle contracts must stay backward-compatible for old binaries. Repeat that sentence in interviews; it's the mobile-specific operational insight most web devs miss.
- **DB:** docker volume locally; managed Postgres in production (per [README deploy notes](../../../README.md)). Backups = provider's problem by choice (solo-dev constraint CON-01).

## Drill

Design the minimal "sync health" observability slice, constrained to 1 hour of work: exactly one client change and one server change. Write the two diffs' descriptions (not code): e.g., client — Header shows amber dot + count when `outbox.length > 0` for >5 min; server — pino child logger tags `/sync` results with accepted/rejected counts, greppable. Then define the alert sentence a human would receive.

Self-grade — Strong: your design distinguishes *user-facing* signal (trust: "your progress is safe/pending") from *operator-facing* signal (rates, not events), and neither blocks the happy path.

Interview angle: "How do you monitor a production service?" → logs/metrics/health-checks triad, then this repo's gap list as your concrete example — naming a *real* shallow-health-check flaw you found beats reciting the three pillars. → [behavioral stories](../08-interview-prep/06-behavioral-star-stories.md)

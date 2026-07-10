# Security Checklist

Map of the standard web-security surface onto this repo. Status: ✅ handled · ⚠️ known gap (tracked in [risk register](../09-reference/risk-register.md)) · ➖ not applicable yet.

| Surface | Status | Evidence / note |
| --- | --- | --- |
| Password storage | ✅ | argon2 ([auth.ts#L9-L11](../../../apps/api/src/auth.ts#L9-L11)); never logged or returned |
| Session tokens | ✅/⚠️ | short JWT + rotating hashed refresh ([auth.ts#L13-L33](../../../apps/api/src/auth.ts#L13-L33)); ⚠️ stored in localStorage on web → XSS-readable ([progress.tsx#L21](../../../apps/web/src/lib/progress.tsx#L21)) |
| Authorization / IDOR | ✅ | structural: `userId` only ever from verified token ([sync.ts#L52](../../../apps/api/src/routes/sync.ts#L52), [me.ts#L9-L26](../../../apps/api/src/routes/me.ts#L9-L26)); no cross-resource ids exist |
| Input validation | ✅ | zod on every body ([sync.ts#L8-L33](../../../apps/api/src/routes/sync.ts#L8-L33), [auth routes#L7-L12](../../../apps/api/src/routes/auth.ts#L7-L12)); bounds on xp/count/batch |
| SQL injection | ✅ | Drizzle parameterized everywhere; no raw SQL in `apps/api` (verified: `rg "sql\`" apps/api` → no hits; the one `sql\`` template is `gen_random_uuid()` in [schema defaults](../../../packages/db/src/schema.ts#L15)) |
| XSS | ✅ (default) | React escapes; no `dangerouslySetInnerHTML` (verified by grep). Content strings from YAML render as text — malicious content YAML would still be inert |
| CSRF | ➖/✅ | no cookie auth ⇒ classic CSRF doesn't apply; Bearer headers require JS. Becomes ⚠️ the day tokens move to cookies — paired decisions, note it |
| SSRF / open redirects | ➖ | server fetches no user-supplied URLs; no redirect endpoints |
| Path traversal | ✅ | filename allowlist regexes before touching disk ([content.ts#L20-L31](../../../apps/api/src/routes/content.ts#L20-L31)) — `^[a-z0-9_]+\.(mp3|wav|m4a|ogg)$` can't contain `..` |
| Rate limiting / brute force | ⚠️ | none on any route ([app.ts#L16-L28](../../../apps/api/src/app.ts#L16-L28)); login + register + refresh are the priority trio |
| CORS | ⚠️ | `origin: true` reflects any origin ([app.ts#L18](../../../apps/api/src/app.ts#L18)) — acceptable for a public API with Bearer auth, but pin origins before cookies ever appear |
| Secrets | ✅/⚠️ | env-only; prod hard-fails on default JWT secret ([env.ts#L18-L20](../../../apps/api/src/env.ts#L18-L20)); ⚠️ no `.env` in web/mobile but API URL baked at build (fine — it's not a secret) |
| Enumeration | ✅/⚠️ | login error is uniform ([routes/auth.ts#L40-L41](../../../apps/api/src/routes/auth.ts#L40-L41)); register reveals "email already registered" — standard tradeoff, know it |
| Dependency risk | ⚠️ | no lockfile audit in CI (no CI at all); `pnpm audit` manual |
| Uploads / webhooks | ➖ | none exist |
| Gamification integrity | ⚠️ | client-asserted xp/timestamps — harmless solo, fatal with leaderboards ([full analysis](../../03-architecture-and-patterns/03-validation-auth-and-permissions.md)) |

## Pre-merge security checklist (use on every PR here)

- [ ] New endpoint: has `preHandler: requireAuth` unless deliberately public — and "deliberately" is written in the PR description.
- [ ] Every id used in a query traces back to `req.userId`, never to the body/params.
- [ ] New body fields validated in zod with *bounds*, not just types.
- [ ] No new `catch {}` that could hide auth/validation failures.
- [ ] Anything filesystem-touching keeps the allowlist pattern.
- [ ] New secrets: env var + fail-fast-in-prod guard like [env.ts#L18-L20](../../../apps/api/src/env.ts#L18-L20).
- [ ] Event schema changes: backward compatible (old events are immortal).
- [ ] If it touches tokens/cookies: re-answer the CSRF/XSS pairing question explicitly.

Drill: run the checklist against review [kata 5 (delete account)](../04-code-reading-gym/04-review-katas.md) and list which boxes catch its problems. (Re-auth requirement falls out of box 1's "deliberately"; client-side data remnants are *not* caught — extend the checklist with your own ninth box.)

Interview angle: "How do you secure an API?" — walk this table top to bottom from memory: storage → sessions → authz → input → injection → transport-adjacent (CORS/CSRF) → abuse (rate limits) → secrets. Having an *order* is what sounds senior. → [Q-cards](../08-interview-prep/03-api-and-data-modeling-questions.md)

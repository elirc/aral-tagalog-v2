# Validation, Auth & Permissions

## The validation map (every layer, every check)

| # | Layer | What's checked | Anchor |
| --- | --- | --- | --- |
| 1 | Content build | authored YAML shape, strict keys, translate direction | [content schema.ts](../../../packages/content/src/schema.ts), [compile.ts#L69](../../../packages/content/src/compile.ts#L69) |
| 2 | API edge | body shapes: email format, password ≥8, event union, batch ≤500, xp ≤100, hearts count ≤20 | [auth routes#L7-L12](../../../apps/api/src/routes/auth.ts#L7-L12), [sync.ts#L8-L33](../../../apps/api/src/routes/sync.ts#L8-L33) |
| 3 | API semantic | timestamp clamp to now; email lowercased before compare | [sync.ts#L56-L57](../../../apps/api/src/routes/sync.ts#L56-L57), [auth routes#L20-L26](../../../apps/api/src/routes/auth.ts#L20-L26) |
| 4 | DB constraints | unique email, unique token hash, composite event PK | [db schema.ts#L16](../../../packages/db/src/schema.ts#L16), [L30](../../../packages/db/src/schema.ts#L30), [L57](../../../packages/db/src/schema.ts#L57) |
| 5 | File serving | filename allowlist regexes (path traversal defense) | [content routes#L20-L31](../../../apps/api/src/routes/content.ts#L20-L31) |
| 6 | Client (UX only) | HTML `required`/`minLength` on auth forms | [AuthForm.tsx](../../../apps/web/src/components/AuthForm.tsx) — *convenience, not security*; the API re-checks |

Teachable structure: **UX validation (client) prevents annoyance; boundary validation (API) prevents attack; constraints (DB) prevent corruption.** All three exist here; being able to assign each check to its tier is the interview answer.

## Authentication vs authorization

- **Authn** (who are you): argon2 password hashes ([auth.ts#L9-L11](../../../apps/api/src/auth.ts#L9-L11)); 15-minute HS256 access JWTs ([L13-L20](../../../apps/api/src/auth.ts#L13-L20)); rotating 30-day refresh tokens stored as sha256 hashes ([L22-L27](../../../apps/api/src/auth.ts#L22-L27)); enforced by the `requireAuth` preHandler ([L36-L50](../../../apps/api/src/auth.ts#L36-L50)).
- **Authz** (what may you touch): this app has exactly one rule — *you may only touch your own data* — and it's enforced structurally: every query filters by `req.userId` taken from the verified token, never from the request body. Check all four sites: [sync insert #L52](../../../apps/api/src/routes/sync.ts#L52), [progress read #L6-L12](../../../apps/api/src/progress.ts#L6-L12), [me read #L9-L16](../../../apps/api/src/routes/me.ts#L9-L16), [me update #L19-L26](../../../apps/api/src/routes/me.ts#L19-L26).

**IDOR** (Insecure Direct Object Reference) — the classic bug where `/api/orders/123` trusts the URL id. This API is structurally IDOR-resistant *because no endpoint accepts a resource id belonging to a user at all*. That's a design-level defense: you can't forget a check that doesn't need to exist. Contrast with the fake-code pair in [fake-code contrasts #5](../04-code-reading-gym/03-fake-code-contrasts.md).

## What a junior misses vs what a senior checks

| Junior misses | Senior checks |
| --- | --- |
| Client `minLength` isn't security | Is every client check re-done at the API? (yes — verified rows 2 vs 6) |
| Where's the "permissions system"? | There isn't one; single-owner scoping *is* the model. When would it break? (sharing/teachers/leaderboards → needs real authz then) |
| JWTs are "secure" | HS256 shared-secret: fine single-service; multi-service needs RS256/JWKS. Also: no revocation for access tokens — 15-min blast radius on account compromise, by design |
| Password rules | No rate limiting on `/auth/login` → credential stuffing risk ([risk register](../09-reference/risk-register.md) R2); no email verification |
| — | Tokens in localStorage on web ([progress.tsx#L21](../../../apps/web/src/lib/progress.tsx#L21)) = XSS-readable; httpOnly-cookie alternative and its CSRF tax |
| — | Trust boundary on event *values*: server bounds xp ≤ 100/event but doesn't verify the lesson exists or that xp matches lesson config — a cheater can legally claim 100xp per event. Gamification integrity is client-trusting by design; becomes untenable the day leaderboards ship. This is the single best "what would you harden" answer in the repo. |

## Drill

Threat-model the day a "friends leaderboard" feature ships, using only what exists: list three ways a player could cheat, which existing lines of defense apply ([sync.ts zod bounds](../../../apps/api/src/routes/sync.ts#L8-L32), clamp), and what new server-side validation becomes mandatory (xp derived server-side from lessonId, lesson existence check against the bundle, per-day caps).

Self-grade — Basic: finds client-trust of xp. Solid: adds timestamp backdating for streaks. Strong: proposes server-side XP derivation *and* notes it breaks offline-first unless the server derives from `lessonId` alone — an actual design tension, not a checkbox.

Interview angle: "How do you prevent users from accessing others' data?" → structural scoping story above. "Where do you validate?" → the three-tier table. → [Q-cards](../08-interview-prep/03-api-and-data-modeling-questions.md), [security checklist](../05-quality-engineering/05-security-checklist.md).

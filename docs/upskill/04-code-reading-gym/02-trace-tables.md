# Trace Tables

Fill each table yourself first (paper or scratch file), then compare. Columns: Step | File:line | Value shape | Owner | Transformation | Risk.

## Trace 1 — UI to API: guest signs up, progress adopted

Start state: guest with 3 events in localStorage outbox.

| Step | File | Value shape | Owner | Transformation | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | [AuthForm.tsx#L20-L31](../../../apps/web/src/components/AuthForm.tsx#L20-L31) | `{email, password, tz}` | UI | form → `api.register` | client-only validation is UX |
| 2 | [routes/auth.ts#L15-L33](../../../apps/api/src/routes/auth.ts#L15-L33) | user row + token pair | API | zod → argon2 → insert | duplicate-email race → 500 |
| 3 | [progress.tsx#L117-L124](../../../apps/web/src/lib/progress.tsx#L117-L124) | tokens persisted; `syncWith(tokens, outbox)` | store | guest events pushed under new identity | outbox held if network dies (safe) |
| 4 | [sync.ts#L47-L60](../../../apps/api/src/routes/sync.ts#L47-L60) | 3 rows keyed (newUserId, eventId) | DB | insert-ignore | — |
| 5 | [progress.tsx#L91-L96](../../../apps/web/src/lib/progress.tsx#L91-L96) | baseline=server progress; outbox=[] | store | adoption | double-count if ordering flipped |

Pause-and-predict before step 4: the guest events carry `occurredAt` from *before* the account existed. Does anything reject them? (No — and that's correct product behavior: pre-signup streak survives. Notice you just derived a product requirement from code.)

## Trace 2 — Persistence: one perfect lesson, wire to DB row to derived XP

| Step | File | Shape | Transformation |
| --- | --- | --- | --- |
| 1 | [LessonPlayer.tsx#L48-L58](../../../apps/web/src/components/LessonPlayer.tsx#L48-L58) | `{id, type:"lesson_completed", lessonId, occurredAt, perfect:true, xp:15}` | core `lessonXp(lesson,true)` = 10+5 |
| 2 | [api.ts#L46-L51](../../../apps/web/src/lib/api.ts#L46-L51) | `{events:[...]}` JSON | serialize |
| 3 | [sync.ts#L42-L60](../../../apps/api/src/routes/sync.ts#L42-L60) | row: payload jsonb, occurred_at bigint | zod parse + clamp |
| 4 | [progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13) | `UserProgress{xpTotal:15,...}` | reduce |
| 5 | [me.ts#L9-L16](../../../apps/api/src/routes/me.ts#L9-L16) | same, JSON | serve |

Risk column exercise: at which single step could `xp:15` become `xp:9999`? (Step 1 — client computes it; step 3 bounds at 100 but doesn't verify against the lesson. You've re-derived risk-register R3 from a trace.)

## Trace 3 — Auth: refresh rotation under a stolen token

Attacker stole refresh token R1; victim still holds R1 too.

| Step | Actor | File | Outcome |
| --- | --- | --- | --- |
| 1 | attacker | [routes/auth.ts#L45-L58](../../../apps/api/src/routes/auth.ts#L45-L58) | R1 row deleted; attacker gets (A2,R2) |
| 2 | victim | same | R1 lookup fails → 401 |
| 3 | victim client | [progress.tsx#L97-L106](../../../apps/web/src/lib/progress.tsx#L97-L106) | refresh attempt fails → throw → swallowed; user effectively logged out on next auth-needed action |
| 4 | — | — | **nothing alerts anyone** — rotation limits damage but doesn't detect theft |

Senior extension: reuse-detection = keep rotated-token hashes with a `replaced_by` chain; a *used* token that was already rotated ⇒ revoke the whole family. Name the table change; this is a classic mid→senior interview follow-up.

## Trace 4 — Error path: Postgres is down, user finishes a lesson (web)

| Step | File | What happens |
| --- | --- | --- |
| 1 | events append locally | [progress.tsx#L80-L86](../../../apps/web/src/lib/progress.tsx#L80-L86) — UI updates instantly (derived locally) |
| 2 | debounce fires `syncNow` | [#L137-L141](../../../apps/web/src/lib/progress.tsx#L137-L141) |
| 3 | fetch rejects | [api.ts#L18-L27](../../../apps/web/src/lib/api.ts#L18-L27) throws |
| 4 | `syncWith` rethrows non-401 | [#L107-L109](../../../apps/web/src/lib/progress.tsx#L107-L109) |
| 5 | `syncNow` swallows | [#L112-L115](../../../apps/web/src/lib/progress.tsx#L112-L115) — outbox intact |
| 6 | retry | next event / next login / next `adoptAuth` — **no timer retry**; a quiet tab retries never |

The user experience: perfect. The operator experience: zero signal. Write the one-sentence incident report this design produces ("users report missing progress on second device; first device shows it fine") and where you'd add the probe.

## Trace 5 — Content: editing a lesson through to both clients

| Step | File | Note |
| --- | --- | --- |
| 1 | edit YAML | [units/01-greetings.yaml](../../../packages/content/course/en-tl/units/01-greetings.yaml) |
| 2 | bump version | [course.yaml](../../../packages/content/course/en-tl/course.yaml) — *manual; forget it and clients never refresh* |
| 3 | `pnpm content:build` | new `course_en_tl_v2.json` + manifest v2 |
| 4 | web | picks it up **at next deploy/build** ([content.ts#L2-L9](../../../apps/web/src/lib/content.ts#L2-L9)) |
| 5 | mobile | [refreshBundleIfNewer](../../../apps/mobile/src/lib/content.ts#L21-L33) downloads on next online launch; shipped-version guard at [L10-L11](../../../apps/mobile/src/lib/content.ts#L10-L11) |

Trap question you should now be able to answer: after step 3 but before a web redeploy, web and mobile show *different content versions*. Is anything broken? (No — progress events reference lesson ids, not content bodies; but a *deleted* lesson id breaks unlock logic — you proved that in [annotation drill 9](01-annotation-drills.md).)

Self-grade across all traces — Basic: rows filled, right files. Solid: risk column populated unprompted. Strong: each trace ends with the one probe/test/alarm you'd add, and Trace 3's family-revocation extension made sense to you.

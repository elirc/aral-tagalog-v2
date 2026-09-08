# Release review: content version 8

The release expands all four tracks by approximately 2.5 times, preserving every original unit, lesson and exercise identifier.

| Track | Units | Lessons |
| --- | ---: | ---: |
| Foundations | 900 | 3,597 |
| Everyday Tagalog | 850 | 3,400 |
| Conversational | 800 | 3,200 |
| Mastery | 300 | 1,200 |
| Total | 2,850 | 11,397 |

There are 102,550 exercises. All 4,557 prior lesson IDs and 40,990 prior exercise IDs remain present. Learners keep access to tiers they have already started when earlier tracks gain lessons.

## Local verification

Verified on Windows with Node 24 and a separate PostgreSQL test database:

- 471 tests passed, including real database authentication integration tests.
- All 15 release tasks passed: tests, type checks, content compilation and the production web build.
- The production dependency audit reported no known vulnerabilities.
- The Vercel API trace is 29.7 MB and includes course data and native password hashing.
- 13 Vercel-path checks and 39 account/progress smoke checks passed against the production Next.js server.
- Browser checks passed for mobile/desktop layout, pagination, lesson completion, guest persistence, account creation, guest-progress merge, logout isolation, login recovery, cross-tab state, delayed-sync logout, settings and phrasebook search.
- A signed-in lesson completed offline, remained queued locally, synced to PostgreSQL after reconnection, and survived reloading.
- Android and iOS production exports were generated; both bundles and their referenced assets were verified.

The release workflow also checks Linux containers and native exports. Hosted Vercel acceptance still requires configuring the intended database and environment variables, then using the [preview checklist](VERCEL.md).

## Content review scope

Every exercise passes structural/reference validation. Template corrections and targeted sampling cover comparative forms, conditional English, idiom predicates, repeated clauses, and constrained noun/verb pairings. Authoring writes are atomic so interruption preserves the previous complete file.

This is not a fluent-speaker review of every generated sentence. Recorded audio is incomplete; device speech synthesis supplies the available fallback. Check language and audio on the intended devices during preview testing.

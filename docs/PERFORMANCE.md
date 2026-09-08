# Loading performance and content delivery

This refactor keeps the full curriculum: **2,850 units, 11,397 lessons, and 102,550 exercises**. It changes when content is loaded and how much data each runtime retains. Progress events, XP rules, lesson grading, authentication, and account synchronization keep their existing contracts.

## Web content

[The compiler](../packages/content/src/compile.ts) produces the existing full course bundle plus smaller web artifacts through [web-assets.ts](../packages/content/src/web-assets.ts):

| Artifact | Purpose |
| --- | --- |
| `packages/content/dist/web/index.json` | Course metadata, ordered unit/lesson titles, and asset filenames; imported by the browser instead of the full curriculum. |
| `unit-<hash>.json` | One unit's complete lessons, exercises, and relevant audio metadata. |
| `vocab-<hash>.json` | Vocabulary and its audio metadata, loaded when the phrasebook opens. |
| 64 `review-<hash>.json` partitions | Exercise-ID-to-unit lookups, fetched as needed to assemble mistake review. |

Filenames contain a content hash. Changed payloads receive new URLs; unchanged payloads remain cacheable. Published web payloads use immutable cache headers. Do not hand-edit generated files: change authored content or the generator, then rebuild.

[CourseContentLoader](../apps/web/src/lib/content-loader.ts) shares concurrent requests, bounds the unit cache, rejects mismatched course versions, and allows failed downloads to retry. Review preserves the oldest-first mistake order and the existing ten-exercise session limit. Navigation uses lesson metadata without downloading exercise bodies; lesson rows avoid bulk route prefetching.

A web lesson downloads its unit when opened. A loaded session can continue without downloading the rest of the course. Opening an uncached unit or phrasebook requires connectivity; a complete offline web curriculum is not promised. Failed content loads offer Retry and Reload app. After a deployment, an older tab may reference a hash that no longer exists: reload to obtain the current index. Retrying the same obsolete URL cannot update that index.

## API and deployment

The API reads `manifest.json` and `sync_catalog.json` from its content directory. The compact catalog contains lesson IDs, authored XP, and exercise counts, sufficient to enforce existing reward and combo limits without retaining exercise bodies. It validates course/version agreement and duplicate IDs. Missing or invalid compiled content fails startup outside development; rebuilding content is required before starting the API.

[prepare-content.mjs](../apps/web/scripts/prepare-content.mjs) copies the current full bundle, manifest, compact catalog, referenced web payloads, and available audio into `apps/web/public/_course`. The full bundle remains available for native content updates. The embedded API redirects large bundle/audio requests to these static assets.

[Next.js tracing](../apps/web/next.config.mjs) explicitly includes the manifest and compact catalog and excludes full course JSON plus public web/audio payloads from the API function. Includes alone do not remove automatically traced assets. Static delivery retains those excluded files. Build worker pools are capped at two to bound memory on smaller hosts; this does not limit deployed request concurrency.

Next 15.5.25 does not normalize Windows backslashes when matching resolved exclusion globs. [finalize-vercel-trace.mjs](../scripts/finalize-vercel-trace.mjs) therefore runs after Next builds and before the independent verifier. It removes only public web/audio assets and public full-course JSON from the API trace, verifies that each removed asset exists, and preserves all other dependencies. The completed Windows build excluded 2,916 static files totaling 54.8 MiB; the verified API trace is **4.7 MiB**.

[The build verifier](../scripts/verify-vercel-build.mjs) checks the required catalog/manifest and native password-hashing binary, rejects full course JSON anywhere in the API trace and any public web/audio assets, enforces the existing 250 MiB trace-size guard, and requires initial JavaScript below **3 MiB per learning route**. That route budget sums unique JavaScript chunks for the layout and route in Next's app build manifest; it is an uncompressed size guard, not a page-load timing measurement.

## Native behavior

Native keeps shipped lesson content available offline. Recorded audio is fetched on demand when used, instead of preloading the entire audio catalog before content becomes usable. An unplayed recording needs connectivity, or a working device text-to-speech fallback. Downloaded/cached recordings and device voice availability determine later offline audio behavior; this change does not promise every recording is preinstalled. Content updates and progress synchronization retain their existing account and event boundaries.

## Measurements and verification

Production compilation, type checking, and generation of all eight static pages passed. Trace finalization and the independent packaging/JavaScript-budget verifier then passed on that completed build. Production HTTP checks passed for the home page, API/database readiness, native bundle redirect, split content versions, and immutable caching.

Production browser checks passed for metadata-only startup, failed-download recovery, separately loaded vocabulary, cached revisits, completing a lesson with a mistake, and reviewing that mistake. No full-course download or browser runtime error occurred. Additional browser checks passed for mobile layout, pagination, an eight-exercise perfect lesson, progress after reload and in a second tab, real API registration, guest-progress merging, logout isolation, login recovery, and preventing a delayed sync response from restoring a logged-out account. Mobile and desktop screenshots were reviewed. These checks used the local test database; no deployment was performed.

| Built asset | Uncompressed bytes | Locally computed gzip bytes |
| --- | ---: | ---: |
| Home route before refactor | 27,281,676 | 4,710,408 |
| Home route after refactor | 2,255,714 | 305,128 |
| Phrasebook route after refactor | 2,247,174 | 303,130 |
| Statistics route after refactor | 2,253,456 | 304,548 |
| Lesson route after refactor | 2,258,904 | 305,852 |
| First unit JSON, loaded separately | 8,872 | 2,183 |

Home-route JavaScript is **91.73% smaller uncompressed and 93.52% smaller with locally computed gzip**. Route measurements sum unique layout-plus-route JavaScript chunks from Next's build manifest. They exclude HTML, CSS, images, and on-demand content; local gzip figures are not measured HTTP transfer sizes or page-load latency. The previous shared full-content chunk alone accounted for 26,876,912 raw bytes and 4,589,513 gzip bytes.

| API startup JSON input, including manifest | Size |
| --- | --- |
| Previous full course | Approximately 27.77 MB |
| Compact catalog | Approximately 1.598 MB; 94.2% smaller |

API MB uses decimal bytes. These artifact sizes establish reduced download/parsing work. No controlled before/after page-load timing was obtained on this slow host, so these results do not establish a wall-clock speedup ratio.

Current test results:

| Suite | Passing tests |
| --- | ---: |
| Core | 163/163 |
| Content | 72/72 |
| Web | 23/23 |
| API, including five real PostgreSQL integration tests | 76/76 |
| Native | 180/185 |

Five strict native image-parser cases still hit their two-second child-process deadline, including when rerun with no build active. An empty Node process needed 9.469 seconds to start. A separate diagnostic using the exact Metro parser rejected all five inputs in between 0.388 and 3.542 milliseconds. The strict suite is unchanged and remains failing; that diagnostic does not replace a passing test run.

From the repository root, use Node 24 and the pinned pnpm version:

~~~powershell
corepack pnpm install --frozen-lockfile
corepack pnpm content:build
corepack pnpm --filter @aral/ui build
$env:NEXT_PUBLIC_API_URL = '/api'
corepack pnpm --filter @aral/web build
corepack pnpm release:check
~~~

The web build copies static content, finalizes the API trace, and automatically runs the packaging/initial-JavaScript verifier. Configure a test database and runtime environment as described in [VERCEL.md](VERCEL.md) before testing account/API behavior. Start the production build with `corepack pnpm --filter @aral/web start`; use the address printed by the server.

Check these flows with the browser Network panel open:

1. Load the course, switch tracks, and paginate. Confirm the full course JSON is absent from browser startup traffic.
2. Open a lesson, complete it, replay it, and reload. Confirm its unit loads on demand and progress remains intact.
3. Open the phrasebook, search, navigate away and back, and play pronunciation. Confirm vocabulary loads separately and cached audio remains usable.
4. Make mistakes across units and start review. Confirm original exercise order, the session cap, and audio after visiting the phrasebook.
5. Simulate an offline content request, reconnect, and Retry. Test Reload app recovery using an obsolete or unavailable asset URL.
6. On native, launch without network access and open shipped lessons. Then test a first-time recording online, a cached recording offline, and device speech fallback.
7. Check account sign-in/out, queued offline progress, synchronization after reconnecting, and `/api/ready`. Reuse the preview deployment checklist rather than testing against production data.

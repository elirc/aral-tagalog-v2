# Boundaries & Layers

## The layer stack, with ownership rules

| Layer | Owns | Must NOT own | Evidence |
| --- | --- | --- | --- |
| `packages/core` | game rules, derivations, event semantics | I/O, host APIs, storage, React | imports in every core file are sibling-only, e.g. [events.ts#L1-L2](../../../packages/core/src/events.ts#L1-L2) |
| `packages/content` | authoring schema, compile-time validation, artifact format | runtime concerns | [compile.ts](../../../packages/content/src/compile.ts) writes files; nothing imports it at runtime |
| `packages/db` | table shapes, migrations | queries/business rules | [schema.ts](../../../packages/db/src/schema.ts) exports tables + `createDb` only |
| `apps/api` | HTTP contracts, authn/z, persistence orchestration | game rules | it computes progress by *calling core* ([progress.ts#L6-L13](../../../apps/api/src/progress.ts#L6-L13)), never re-implementing |
| `apps/web`, `apps/mobile` | presentation, local persistence, sync scheduling | game rules, server trust decisions | e.g. grading never happens in components — [TapsView](../../../apps/web/src/components/exercises/TapsView.tsx) only collects tokens |

**Boundary** definition for interviews: a line across which dependencies point only one way and data crosses only in agreed shapes. The strongest boundary here is core's: it makes rules testable in milliseconds ([27 tests, no mocks](../../../packages/core/src)) and reusable across three runtimes.

## Good boundary examples (study these)

1. **Grading knows exercises, not DOM events.** UI converts taps → `string[]`; `grade()` sees only data ([grading.ts#L35-L45](../../../packages/core/src/grading.ts#L35-L45)). You could pipe answers from a CLI or a test with zero changes.
2. **The server treats events as opaque-ish payloads.** `/sync` validates shape, stamps `userId`, stores, derives ([sync.ts#L47-L64](../../../apps/api/src/routes/sync.ts#L47-L64)). It never contains "if lesson completed then add XP" logic — that's the reducer's job, shared with clients. One implementation of the rules, three consumers.
3. **Ads seam** — an interface in core ([ads.ts#L5-L17](../../../packages/core/src/ads.ts#L5-L17)) with a no-op default, so the AdMob SDK will only ever be imported by mobile. Dependency direction protected *in advance*; this is how you keep vendor SDKs from metastasizing.

## Boundary leaks and soft spots (real, verified)

1. **Duplicated store logic across clients.** Web ([progress.tsx](../../../apps/web/src/lib/progress.tsx)) and mobile ([progress.tsx](../../../apps/mobile/src/lib/progress.tsx)) implement the same outbox/baseline/refresh-retry choreography twice (~150 lines each, structurally parallel). Not a layering *violation* — but duplicated *policy*, which will drift. A `createProgressStore(storageAdapter)` in core is the classic extraction; see [refactor katas](../../06-contribution-practice/04-refactor-and-design-katas.md).
2. **Event zod schemas live in the API, types in core** ([sync.ts#L8-L32](../../../apps/api/src/routes/sync.ts#L8-L32) vs [events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31)). The contract's *checker* and *definition* are owned by different layers.
3. **UI→content naming coupling:** [MatchView.tsx#L39](../../../apps/web/src/components/exercises/MatchView.tsx#L39) derives an audio ref from displayed text by convention. The bundle's `audio` map is the contract; this bypasses it.
4. **Web CSS duplicates `packages/ui` tokens by hand** — comment admits it ([globals.css#L1](../../../apps/web/src/app/globals.css#L1)). Cheap now; drifts silently.

None of these is a bug. Ranking them by cost-to-fix vs drift-risk is exactly mid-level→senior judgment: (2) is cheapest and most valuable (move schemas to core, infer types); (1) is highest value but needs design care; (3) is a 5-line fix; (4) is cosmetic until a redesign.

## Drill

For each leak above, write one sentence: who pays the cost, when, and how you'd notice. Then pick the one you'd fix first and defend it in 60 seconds aloud.

Self-grade — Basic: descriptions correct. Solid: costs assigned to concrete future events ("adding a 6th event type requires edits in 2 places and nothing fails if you forget one"). Strong: your fix order matches effort/risk reasoning, and you can name what you would *not* fix and why.

Interview angle: "Describe the architecture of a codebase you know well" — the layer table plus one leak-you'd-fix is a complete senior-signal answer. Cross-link: [system design](../08-interview-prep/04-system-design-from-this-repo.md).

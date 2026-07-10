# Code Review Mindset

## The five layers, in review order

1. **Does it work?** — run/trace the happy path.
2. **Is it correct?** — edges, races, failure modes (the layer juniors skip).
3. **Will it stay correct?** — tests pinning the behavior; contracts respected.
4. **Does it fit?** — follows this repo's patterns or justifies deviation.
5. **Is it kind to future maintainers?** — names, comments where *why* is non-obvious, no cleverness tax.

Block on 1–3. Discuss 4. Suggest 5. Mixing these levels (blocking on naming while missing a race) is the most common junior-reviewer failure.

## Repo-specific review checklist

- Events: any new/changed `ProgressEvent` field is additive & optional; the reducer handles absence ([events.ts#L13-L31](../../../packages/core/src/events.ts#L13-L31) is a forever-contract).
- Core purity: nothing in `packages/core` imports platform APIs or calls `Date.now()` (time is a parameter — [events.ts#L49-L54](../../../packages/core/src/events.ts#L49-L54)).
- API: new routes have `requireAuth` or a written exemption; new inputs zod-bounded; ids from token not body ([security checklist](../05-quality-engineering/05-security-checklist.md)).
- Clients: outbox invariants preserved (clear only after ack; reducer input = unsynced only).
- Content: compiler still passes; version bumped if artifacts changed.
- Both clients updated when shared behavior changes (web + mobile drift check).

## Comment language that works

Pattern: **quote the specific concern → state the consequence → propose a direction → leave room.**

> "`syncNow` here can run concurrently with the debounced one (both awaited nothing) — two in-flight `/sync` calls would race baseline adoption. Could we guard with the in-flight flag like the mobile store does, or serialize through one entry point?"

> "Nit (non-blocking): `data2` — maybe `serverProgress` to match `progress.tsx` naming."

> "This changes the `/sync` response shape — mobile binaries in the field parse the old one. Can we make the new field additive instead? Happy to pair on the compat check."

Anti-patterns: "this is wrong" (no consequence), "why didn't you just…" (status move), rewriting the PR in comments (do it in a suggestion or pair instead), 40 nits and no verdict.

Drill: review [kata 1](../04-code-reading-gym/04-review-katas.md) again, but this time write *only three comments maximum* — forced prioritization. Strong = your three are the two Blockings + a summary verdict comment that says what you did NOT review (e.g., "didn't check mobile parity").

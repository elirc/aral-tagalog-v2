# Course authoring

Run `corepack pnpm content:generate --bump` from the repository root to append units up to the current quotas. Existing unit and lesson IDs stay in place. The generator targets 900 Foundations, 850 Everyday, 800 Conversational and 300 Mastery units including hand-authored lessons.

Edit the lexicon and templates here, then run `corepack pnpm --filter @aral/content review` to apply the version 8 corrections. The review preserves progress IDs and coordinates prompts, word banks and answers when semantic changes require rebuilding exercises. Repeating the review makes no further changes.

Compile with `corepack pnpm content:build`. The compiler validates every exercise and reference. Run content and core tests before release. Increment the content version for any subsequent published content change.

Default generation appends. `--clean` deletes generated units; `--rebuild` replaces them. Both are intentional authoring operations that require reviewing progress compatibility before publishing.

Version 8 adds 1,710 units, 6,840 lessons and 61,560 exercises. Automated validation and targeted sentence sampling cover grammar templates, answer banks, reference integrity, comparison forms, conditional English and known invalid word pairings. This does not constitute a native-speaker review of every generated sentence; include language review in preview testing.

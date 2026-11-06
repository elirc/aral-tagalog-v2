# Aral roadmap

What is still open against `SPEC.md`, plus what the last releases surfaced.
Status as of 2026-11-06. Milestone and item codes (M4, AUD-02, OQ-04...) are the
ones SPEC.md and the README use.

## Done, for reference

M1 skeleton, M2 core loop (all five exercise types, XP, streaks, hearts), M3
offline (SQLite mirror, outbox sync, bundle versioning), guest mode (OQ-03),
refresh-token families with reuse detection, the mistakes-review engine, 51
units and 1,788 exercises (August 2026), production hardening with the 29-check
smoke suite, and the mobile-phone optimization pass (October 2026).

## Next

1. **Audio (M4, SPEC section 5, AUD-02).** No clips exist yet: every exercise and
   vocabulary entry carries an `audio_ref` and the players fail silently when
   the clip is missing. Generate the en-tl clips with Piper through
   `packages/content/scripts/generate-audio.mjs`, listen to a sample from each
   unit, and ship the clips in the bundle (mobile already handles offline
   audio).
2. **Content review by a fluent speaker (M4).** The course is a starter draft.
   Review unit by unit, fix the corrections in the YAML sources, and let the
   compiler reject anything ambiguous.
3. **README counts.** The README still says 18 units, 69 lessons and 584
   exercises; the August content release shipped 51 units and 1,788 exercises.
   Update the numbers and the course-status section.
4. **Remaining M5 polish (SPEC section 11).** AdMob behind the existing no-op ads
   provider (GAM-04), streak notifications, and EAS builds for the Expo app.
5. **First deployment (README, "Deploying").** API on a free tier with managed
   Postgres, web on Vercel, mobile pointed at the deployed API, then the smoke
   suite against production. Document the restart-after-content-ship rule where
   the deploy steps live.

## Later

- Content tables in Postgres if the immutable bundles outgrow files (README,
  "Deliberate simplifications", item 1).
- A derived-state cache table if `/me` gets slow (item 2).
- Runtime bundle download on web instead of build-time bundling (item 3).
- Baybayin script as bonus content (OQ-04); app name and branding (OQ-01).

---
title: "Aral — Tagalog Learning App Specification"
version: 0.1.0
status: Draft
author: Solo developer
last_updated: 2026-07-09
---

# Aral — Tagalog Learning App Specification

*"Aral" (to study/learn) — working title, rename freely.*

## 1. Overview

A Duolingo-style language learning app teaching **Tagalog to English speakers**, targeting **absolute beginners**. Web (React) and mobile (React Native) clients share code in a **monorepo**. Backend is **Node.js + PostgreSQL**. All content is free; engagement uses a **hearts + ads** model with **XP and streaks** gamification. **Offline support is mandatory** on mobile.

**Constraints that shape every decision:**
- **CON-01:** Solo developer; primary tooling budget is a Claude Max subscription (build with Claude Code assistance). Minimize operational complexity.
- **CON-02:** Near-zero recurring API costs. No paid TTS, speech, or translation APIs.
- **CON-03:** Author writes all lesson content; content lives in the codebase/DB, no third-party content licensing.
- **CON-04:** Design must extend later to (a) other base languages (e.g., Tagalog for Spanish speakers) and (b) potentially other target languages, without schema rewrites.

## 2. Goals and Non-Goals

**Goals (v1):**
- G-01: Complete beginner course: ~5 units × 5 lessons, each lesson 8–15 exercises.
- G-02: Core exercise types: translate (tap-the-words), multiple choice, listening, matching pairs, fill-in-the-blank.
- G-03: XP per lesson, daily streak with local-timezone rollover.
- G-04: Hearts system (lose on mistakes, regenerate over time, refill by ad or practice).
- G-05: Full offline lesson play on mobile with background sync.
- G-06: Audio for every Tagalog sentence and word.

**Non-Goals (v1):**
- NG-01: Speech recognition / pronunciation grading (revisit later with on-device models).
- NG-02: Leagues/leaderboards, friends, social features.
- NG-03: Multiple base or target languages (schema supports it; UI does not).
- NG-04: Stories, podcasts, chatbots.

## 3. Architecture

```
apps/
  mobile/        # Expo (React Native)
  web/           # Next.js (React)
  api/           # Node.js (Fastify) REST API
packages/
  core/          # Shared TS: exercise engine, grading, XP/streak/hearts logic
  content/       # Lesson source files (YAML) + build scripts
  ui/            # Shared design tokens; platform components live in apps
  db/            # Drizzle ORM schema + migrations
  config/        # Shared tsconfig, eslint
```

- **ARCH-01 Monorepo:** pnpm workspaces + Turborepo. Expo for mobile (EAS builds), Next.js for web.
- **ARCH-02 Shared logic, native UI:** All game logic, grading, and state machines live in `packages/core` (pure TypeScript, zero platform deps, fully unit-testable). UI is written per-platform against the same core — avoids React Native Web's styling compromises while keeping the hard logic 100% shared.
- **ARCH-03 API:** Fastify + Drizzle ORM + PostgreSQL. JWT auth (access + refresh). Deployable on a single small VPS or free-tier host (Fly.io/Railway) with managed Postgres (Neon/Supabase free tier).
- **ARCH-04 Offline-first mobile:** SQLite (expo-sqlite) mirrors course content and progress. See §7.
- **ARCH-05 Web:** Online-first; optional PWA caching later.

## 4. Content Model (extensibility lives here)

Content is authored in **YAML files in `packages/content`**, validated by Zod schemas, and compiled into (a) seed data for Postgres and (b) a versioned **content bundle** (JSON + audio manifest) that clients download for offline use.

```
Course (base_lang, target_lang, version)   ← extensibility point (CON-04)
 └── Unit (title, description, order)
      └── Lesson (title, order, xp_reward)
           └── Exercise (type, prompt, answer(s), distractors, audio_ref, hints)
Vocabulary (lemma, translation, audio_ref, notes)  ← shared across lessons
```

- **CNT-01:** Every `Course` is keyed by `(base_lang, target_lang)`. v1 ships exactly one: `(en, tl)`. Adding `(es, tl)` later = new content files, zero schema change.
- **CNT-02:** Exercises reference vocabulary by ID so audio and translations aren't duplicated.
- **CNT-03:** Content bundles are immutable and versioned (`course_en_tl_v3.json`). Clients check version on launch and download deltas.
- **CNT-04:** Answer grading (in `core`) normalizes case, punctuation, and accepts alternate answers listed in content. Tagalog-specific: accept both `ng`/`nang` where the lesson allows, tolerate missing hyphens in reduplication (e.g., `araw-araw` vs `araw araw`) when flagged.

**Example lesson YAML:**

```yaml
lesson: greetings-1
title: "Greetings"
xp: 10
exercises:
  - type: choice
    prompt: "How do you say 'good morning'?"
    answer: "Magandang umaga"
    distractors: ["Magandang gabi", "Salamat", "Paalam"]
    audio: magandang_umaga
  - type: translate_taps
    prompt_tl: "Kumusta ka?"
    answer_en: "How are you?"
    word_bank: ["How", "are", "you", "good", "morning", "thanks"]
    audio: kumusta_ka
```

## 5. Audio Strategy (zero API cost)

- **AUD-01 Primary — self-recorded:** Record your own (or a native speaker friend's) audio for all course vocabulary and sentences. At beginner scope (~600–900 clips) this is a few weekends of work with a phone mic + Audacity normalization. Highest quality, zero cost, fully offline.
- **AUD-02 Fallback — local open-source TTS at build time:** For clips not yet recorded, generate audio **offline at content-build time** using a free local TTS (e.g., Piper or Coqui with a Filipino voice model). Generated files are checked into the content bundle like recorded ones — no runtime TTS, no API, works offline.
- **AUD-03:** Audio ships as compressed `.m4a`/`.ogg` in the content bundle; manifest maps `audio_ref → file`. Clips are cached on device (mobile) and lazily fetched + cached (web).
- **AUD-04:** Never use device runtime TTS for lesson audio (inconsistent Tagalog support and pronunciation across devices). Runtime TTS is acceptable only as an accessibility fallback.

## 6. Gamification

- **GAM-01 XP:** Fixed XP per lesson completion (default 10), +5 for a perfect run (no hearts lost). XP is append-only events in DB → daily/weekly totals derived, so future leaderboards need no migration.
- **GAM-02 Streaks:** A day counts if ≥1 lesson completed. Rollover at local midnight (client sends timezone; server stores IANA tz per user). Offline completions count toward streaks once synced — streak calculation uses the **completion timestamp recorded on device**, not sync time.
- **GAM-03 Hearts:** 5 max. Lose 1 per wrong answer. Regenerate 1 per 4 hours. Refill options: watch a rewarded ad (mobile, AdMob), or complete a practice (review) session. Web: no ads in v1 → practice-to-refill only.
- **GAM-04 Ads:** Mobile only in v1: AdMob rewarded ads (heart refills) + optional interstitial after every N lessons (default N=3, remotely configurable). Keep ad SDK code isolated behind an interface in `core` so it can be disabled per build (useful for your own personal builds).

## 7. Offline Support (mobile)

- **OFF-01:** On first login (online), the full content bundle + audio downloads to device SQLite/filesystem. All lessons are playable offline thereafter.
- **OFF-02:** Progress (lesson completions, XP events, hearts state, streak-relevant timestamps) writes to a local **outbox queue**; a sync worker flushes to the API when connectivity returns.
- **OFF-03 Conflict policy:** Server merges by event, not by state — XP events are additive; lesson completion is idempotent (unique per user+lesson+timestamp); hearts resolve to the server-computed value after replaying events. Last-writer-wins only for profile settings.
- **OFF-04:** Content updates: on launch (online), compare bundle version; download delta in background; never block play.
- **OFF-05:** Hearts regeneration works offline (computed from timestamps, no server clock dependency; clamp obvious clock tampering server-side on sync).

## 8. Data Model (Postgres, Drizzle)

Key tables (abridged):

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email, password_hash, tz, created_at | Argon2 hashing |
| `courses` | id, base_lang, target_lang, version | (en, tl) in v1 |
| `units` / `lessons` / `exercises` | course_id, order, payload JSONB | payload = compiled exercise JSON |
| `vocab` | id, lemma, translation, audio_ref | |
| `xp_events` | user_id, amount, source, occurred_at | append-only |
| `lesson_completions` | user_id, lesson_id, occurred_at, perfect | unique(user, lesson, occurred_at) |
| `user_state` | user_id, hearts, hearts_updated_at, streak_count, last_streak_day | derived, rebuildable from events |

- **DAT-01:** Exercise `payload` as JSONB keeps exercise types flexible; Zod validates at content build, so DB stays schema-light.
- **DAT-02:** Everything user-progress is event-sourced-lite → offline sync and future features (leaderboards, stats) come cheap.

## 9. API Surface (REST, abridged)

```
POST /auth/register | /auth/login | /auth/refresh
GET  /content/courses/en-tl/manifest      # bundle version + audio manifest
GET  /content/bundles/:version            # full or delta bundle
POST /sync                                # batch: xp_events, completions, state
GET  /me                                  # profile, streak, hearts, xp totals
```

- **API-01:** `/sync` is the only write path for progress → one idempotent batch endpoint keeps offline logic simple.

## 10. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm + Turborepo | Fast, simple, standard |
| Mobile | Expo (RN) + expo-sqlite + expo-av | EAS handles builds; solo-friendly |
| Web | Next.js | Free hosting (Vercel), SSR for landing/SEO |
| API | Fastify + Zod | Fast, typed, minimal |
| DB | PostgreSQL + Drizzle | Typed migrations, portable |
| Auth | JWT (jose) + Argon2 | No auth-provider cost |
| Ads | AdMob (react-native-google-mobile-ads) | Rewarded + interstitial |
| TTS (build-time) | Piper/Coqui local | Zero API cost (AUD-02) |
| Testing | Vitest (core, api), Maestro (mobile E2E, later) | Core logic is where tests pay off |

## 11. Milestones

1. **M1 — Skeleton (week 1–2):** Monorepo, DB schema, auth, content compiler with 1 sample lesson, lesson player (choice + translate) on mobile, online only.
2. **M2 — Core loop (week 3–4):** All 5 exercise types, XP, streaks, hearts (no ads), web player.
3. **M3 — Offline (week 5–6):** SQLite mirror, outbox sync, bundle versioning.
4. **M4 — Content + audio (ongoing):** Author 5 units; record/generate audio.
5. **M5 — Polish (week 7–8):** Ads, practice mode (heart refill), streak notifications, EAS builds.

## 12. Open Questions

- OQ-01: App name and branding.
- OQ-02: Practice/review algorithm — simple "weakest recent words" vs. light spaced repetition (SM-2-ish)?
- OQ-03: Anonymous/guest mode before account creation? → **v1 answer: yes** — both clients play as guest locally; registering adopts guest progress.
- OQ-04: Baybayin script as bonus content later?

# Framework Mental Models

## React: render is a function of state; effects are escape hatches

**Model:** a component is `state → UI description`. Renders must be pure; anything that touches the outside world (storage, network, timers, subscriptions) belongs in an effect or event handler. Commit ≠ render: React may render twice (StrictMode) and throw the result away.

### Where this repo uses it well

- **Reducer-style engine outside React** — `SessionState` lives in `useState` but all transitions are pure core functions ([LessonPlayer.tsx#L35-L37](../../../apps/web/src/components/LessonPlayer.tsx#L35-L37) holding state produced by [submitAnswer](../../../packages/core/src/session.ts#L45-L84)). The component can't corrupt game rules; the rules can't touch the DOM.
- **Exactly-once side effect with a ref** — [`completionSent`](../../../apps/web/src/components/LessonPlayer.tsx#L39-L59). Effects re-run (StrictMode, dependency changes); refs survive renders without triggering them. This is the canonical fix for "my effect fired twice and double-charged the user."
- **Key-driven remount** — `key={`${exercise.id}-${attempt}`}` ([LessonPlayer.tsx#L122](../../../apps/web/src/components/LessonPlayer.tsx#L122)) resets each exercise view's internal state on retry instead of writing manual reset logic. Keys are identity, not just list bookkeeping.
- **Context as store** — [ProgressProvider](../../../apps/web/src/lib/progress.tsx#L59-L153) memoizes its value ([L143-L146](../../../apps/web/src/lib/progress.tsx#L143-L146)); every consumer re-renders when progress changes, which is correct here (header shows hearts/XP). At larger scale you'd split contexts or use a selector store — know the escalation path (context → zustand/jotai → redux) and the trigger (unrelated re-renders profiled, not vibes).

### Sharp edges present here

- **Stale closure risk:** the sync effect ([progress.tsx#L137-L141](../../../apps/web/src/lib/progress.tsx#L137-L141)) depends on `syncNow`, which is `useCallback`-wrapped with `[auth, outbox, syncWith]` — forget a dep and you'd sync stale outboxes. The lint rule is your friend; disabling it is how these bugs are born.
- **Derived state on a 30s tick** ([L70-L72](../../../apps/web/src/lib/progress.tsx#L70-L72)): a `tick` counter forces recomputation of time-dependent values. Cheap and honest, but note the alternative (compute-on-read in children) and its cost (every consumer must pass `now`).
- **Possible risk:** [MatchView.tsx#L39](../../../apps/web/src/components/exercises/MatchView.tsx#L39) guesses audio refs from the matched word (`left.replace(/\s+/g, "_")`) — a naming-convention coupling between UI and content. Harmless today (playback fails silently), but it's an unwritten contract. Good review-comment material.

## React Native: same model, different host

Mobile components mirror web ones ([mobile TapsView](../../../apps/mobile/src/components/exercises/TapsView.tsx) vs [web TapsView](../../../apps/web/src/components/exercises/TapsView.tsx)) — same props contract (`exercise`, `onAnswerChange`, `disabled`), different primitives (`Pressable`/`View` vs `button`/`div`). The shared thing is the *engine*, not the components (ARCH-02 in [README](../../../README.md)). Interview line: "we shared logic, not pixels — React Native Web was rejected to keep native styling honest."

## Next.js (App Router) as used here

The web app uses Next minimally: file-system routes (`app/page.tsx`, `app/lesson/[lessonId]/page.tsx`), everything `"use client"` because state is client-local. No server components with data fetching, no API routes — the API is a separate Fastify service. Know *why* this is still Next and not Vite SPA: free static hosting/SSR shell, and a growth path to SSR'd marketing pages. Dynamic route params come from `useParams` ([lesson page.tsx#L10-L12](../../../apps/web/src/app/lesson/%5BlessonId%5D/page.tsx#L10-L12)).

## Fastify mental model

Plugins + decorators + hooks. This repo: one `buildApp()` factory ([app.ts#L16-L28](../../../apps/api/src/app.ts#L16-L28)) that registers CORS, decorates `app.db` (dependency injection Fastify-style — handlers reach `app.db`, tests could inject another), and mounts route groups as plain functions. Auth is a **preHandler hook** per route ([sync.ts#L41](../../../apps/api/src/routes/sync.ts#L41)) rather than global middleware — explicit allowlisting of protected routes; the opposite default (protect-all, opt out) is safer at scale. Worth saying in interviews.

## Drills

1. Delete the `completionSent` ref mentally: enumerate every way `lesson_completed` could fire twice. (StrictMode double-effect; `practice`/`lesson` identity change re-running the effect.)
2. In mobile [index.tsx](../../../apps/mobile/app/index.tsx), the course map recomputes unlock state on every render. Estimate the work (units × lessons) and argue whether memoization is justified. (No — dozens of items; measure first.)
3. Trace what re-renders when a heart regenerates: tick → `progress` memo recomputes → context value identity changes → all consumers re-render. Which consumers waste work?

Self-grade — Strong: each answer names the React mechanism (effect lifecycle, memo identity, reconciliation by key) rather than "React just does that."

## Interview angle

- "How do you prevent an effect from double-firing a mutation?" → `completionSent` ref, StrictMode story. → [frontend Q-cards](../08-interview-prep/02-frontend-framework-questions.md)
- "Context vs external store?" → this repo's context-with-memo, the escalation path, and the profiling trigger.
- "How would you share code between React web and native?" → engine-not-components, with `packages/core` as evidence.
- "What do keys actually do?" → attempt-keyed remount example.

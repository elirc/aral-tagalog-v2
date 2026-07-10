# Frontend Framework Cards

11 cards on React/Next/RN, anchored to real components.

## Q1: Why did your effect fire twice and what did you do about it?
Round: frontend. Testing: StrictMode understanding.
Repo anchor: [completionSent ref](../../../apps/web/src/components/LessonPlayer.tsx#L39-L59).
Junior: "StrictMode bug, I turned it off."  ← instant red flag
Mid: StrictMode double-invokes on purpose to expose unsafe effects; guard non-idempotent actions with a ref, or make the downstream idempotent.
Senior: both belt and suspenders here — ref latch *and* server-side event dedupe; and why the latch is still load-bearing (each invocation would mint a fresh UUID, [pattern 14](../../03-architecture-and-patterns/05-pattern-catalog.md)).
Follow-up: "Why a ref and not state?" (state update re-renders and races; refs are render-invisible).

## Q2: Where do you put state? Walk me through a real decision.
Round: frontend. Repo anchor: session state in the player component ([LessonPlayer.tsx#L35-L37](../../../apps/web/src/components/LessonPlayer.tsx#L35-L37)) vs progress in context ([progress.tsx#L59-L153](../../../apps/web/src/lib/progress.tsx#L59-L153)) vs picked-words local to [TapsView#L18](../../../apps/web/src/components/exercises/TapsView.tsx#L18).
Junior: "Lift state up when shared."
Mid: three tiers with reasons — ephemeral view state stays in the leaf (resets via `key` remount!); session spans one screen; progress is app-wide with persistence.
Senior: state *ownership* — who is allowed to mutate; the engine owns transitions, components merely dispatch. Ask "who else reads this?" before placing.

## Q3: How do keys work beyond list indices?
Round: frontend. Repo anchor: `key={exercise.id-attempt}` remount trick ([LessonPlayer.tsx#L122-L136](../../../apps/web/src/components/LessonPlayer.tsx#L122-L136)).
Junior: "unique ids for lists."
Mid: keys are identity for reconciliation; changing a key deliberately discards-and-recreates a subtree — declarative state reset.
Senior: when that's better than imperative resets (fewer effects, no forgotten fields) and its cost (loses focus/animation state; fine here).

## Q4: Your context re-renders everything — when is that a problem and what's the fix ladder?
Round: frontend. Repo anchor: memoized provider value ([progress.tsx#L143-L146](../../../apps/web/src/lib/progress.tsx#L143-L146)); consumers: Header, pages, player.
Junior: "use Redux."
Mid: measure first (React Profiler); this app's consumer count makes it a non-issue; the ladder is split contexts → selector-based store → memoized subtrees.
Senior: the *reason* context has no selectors (identity-based propagation), and the 30s tick design ([L70-L72](../../../apps/web/src/lib/progress.tsx#L70-L72)) as a deliberate freshness/cost tradeoff for time-derived values.

## Q5: How would you share code between React DOM and React Native?
Round: frontend/architecture. Repo anchor: parallel TapsViews ([web](../../../apps/web/src/components/exercises/TapsView.tsx) / [mobile](../../../apps/mobile/src/components/exercises/TapsView.tsx)) over one engine ([session.ts](../../../packages/core/src/session.ts)).
Junior: "React Native Web."
Mid: share logic (pure core, hooks) not pixels; identical props contracts keep the ports mechanical.
Senior: the explicit rejection of RN-Web in this repo's design (ARCH-02, [README](../../../README.md)) — styling compromises vs duplication cost, and where the line moves (design-system-heavy apps).

## Q6: A user says the UI shows stale hearts. Debug it.
Round: frontend/debugging. Repo anchor: derived hearts need `regenerate(state, now)` at read ([Header.tsx](../../../apps/web/src/components/Header.tsx), [hearts.ts#L18-L27](../../../packages/core/src/hearts.ts#L18-L27)); re-render driven by the 30s tick.
Mid path: is it a *computation* miss (forgot regenerate) or a *render* miss (nothing re-rendered)? Two different fixes; the tick handles the latter.
Senior: the API-shape fix that removes the bug class (expose only `currentHearts(state, now)`), from [flow 6](../../01-codebase-cartography/05-key-flows.md).

## Q7: Controlled vs uncontrolled inputs — where did you choose which?
Round: frontend. Repo anchor: controlled auth form ([AuthForm.tsx#L38-L56](../../../apps/web/src/components/AuthForm.tsx#L38-L56)); FillBlank's chip-select is state-controlled; free-text variant is controlled input ([FillBlankView.tsx](../../../apps/web/src/components/exercises/FillBlankView.tsx)).
Mid: controlled when value feeds live logic (enable Check button on non-empty); uncontrolled+ref for fire-once reads.
Senior: forms at scale (per-keystroke renders) and when a form library earns its weight — not at two fields.

## Q8: What's your data-fetching story without React Query/tRPC?
Round: frontend. Repo anchor: hand-rolled `request<T>` + explicit store ([api.ts#L18-L27](../../../apps/web/src/lib/api.ts#L18-L27), [progress.tsx](../../../apps/web/src/lib/progress.tsx)).
Junior: "should've used React Query."
Mid: this app's server state is *tiny* (one baseline object) and writes flow through an outbox — a cache library would sit idle; local-first flips the usual client-cache problem.
Senior: name what React Query actually solves (dedupe, staleness, revalidation of *server-owned* reads) and the trigger to adopt it (multiple server-owned read models). Tool choice from data shape, not fashion.

## Q9: How does the app work offline on web vs mobile?
Round: frontend/architecture. Repo anchor: web is online-first with a localStorage outbox (writes survive, reads are build-time bundle — [content.ts#L2-L9](../../../apps/web/src/lib/content.ts#L2-L9)); mobile ships content + SQLite ([storage.ts](../../../apps/mobile/src/lib/storage.ts), [content.ts](../../../apps/mobile/src/lib/content.ts)).
Mid: articulate the split and why (platform constraints — app stores vs redeploys).
Senior: what "offline" decomposes into — reads (content), writes (events), auth (tokens expire!) — and which layer solves each.

## Q10: Accessibility — what would you fix first in this app?
Round: frontend. Repo anchor: word-bank buttons are real `<button>`s (good, keyboardable — [TapsView.tsx#L47-L75](../../../apps/web/src/components/exercises/TapsView.tsx#L47-L75)); gaps: audio-only exercises have no text alternative, feedback banner isn't `aria-live`, heart/streak emojis lack labels beyond `title` ([Header.tsx](../../../apps/web/src/components/Header.tsx)).
Mid: prioritize by user impact: `aria-live` on the result banner (screen readers currently miss correctness feedback entirely) > labels > focus management on phase change.
Senior: listening exercises need a policy decision (transcript defeats the exercise; "replay slowly" is the a11y-preserving alternative) — a11y as product design, not attribute sprinkling.

## Q11: Next.js — why is this app almost all client components, and when would that change?
Round: frontend. Repo anchor: every page is `"use client"`; state is device-local by design.
Junior: "Server components are newer/better."
Mid: RSC pays off for server-owned data (fetch on server, less JS); this app's data is *client-owned* (localStorage, offline) — RSC has nothing to fetch.
Senior: the boundary will move if/when SSR'd marketing or shared leaderboards appear; keeping the lesson player client-only remains correct regardless. Rendering strategy follows data ownership.

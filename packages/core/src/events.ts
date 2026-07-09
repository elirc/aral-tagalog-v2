import { addHearts, fullHearts, loseHeart, regenerate, type HeartsState } from "./hearts";
import { applyCompletionDay, emptyStreak, localDayKey, type StreakState } from "./streak";

/**
 * All user progress is an append-only event stream (DAT-02). Clients write
 * events locally (offline outbox on mobile) and POST them to /sync; the
 * server and clients both derive state with reduceEvents, so they agree.
 *
 * `id` is a client-generated UUID — the idempotency key for sync (OFF-03).
 * `occurredAt` is the device-local wall clock in epoch ms (streaks use it,
 * not sync time).
 */
export type ProgressEvent =
  | {
      id: string;
      type: "lesson_completed";
      lessonId: string;
      occurredAt: number;
      perfect: boolean;
      xp: number;
      /** practice replays refill a heart instead of granting first-time completion */
      practice?: boolean;
    }
  | { id: string; type: "hearts_lost"; occurredAt: number; count: number }
  | {
      id: string;
      type: "hearts_refilled";
      occurredAt: number;
      amount: number | "full";
      source: "ad" | "practice";
    };

export interface UserProgress {
  xpTotal: number;
  /** first-time completions, for the course map */
  completedLessonIds: string[];
  streak: StreakState;
  hearts: HeartsState;
}

/**
 * Fold an event stream into user progress. Events are sorted by occurredAt
 * internally; callers may pass them in any order (offline batches arrive late).
 *
 * `initial` lets clients overlay unsynced local events on top of a
 * server-provided baseline (the /sync response) — the server reduces the
 * full stream from scratch, clients reduce just their outbox.
 */
export function reduceEvents(
  events: ProgressEvent[],
  timeZone: string,
  now: number,
  initial?: UserProgress,
): UserProgress {
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const completed = new Set<string>(initial?.completedLessonIds ?? []);
  let xpTotal = initial?.xpTotal ?? 0;
  let streak = initial?.streak ?? emptyStreak;
  let hearts = initial?.hearts ?? fullHearts(sorted[0]?.occurredAt ?? now);

  for (const ev of sorted) {
    // clamp future timestamps (clock tampering / skew) to now (OFF-05)
    const t = Math.min(ev.occurredAt, now);
    switch (ev.type) {
      case "lesson_completed":
        xpTotal += ev.xp;
        streak = applyCompletionDay(streak, localDayKey(t, timeZone));
        if (!ev.practice) completed.add(ev.lessonId);
        else hearts = addHearts(hearts, 1, t);
        break;
      case "hearts_lost":
        for (let i = 0; i < ev.count; i++) hearts = loseHeart(hearts, t);
        break;
      case "hearts_refilled":
        hearts = addHearts(hearts, ev.amount, t);
        break;
    }
  }

  return {
    xpTotal,
    completedLessonIds: [...completed],
    streak,
    hearts: regenerate(hearts, now),
  };
}

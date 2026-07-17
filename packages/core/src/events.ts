import { addHearts, fullHearts, loseHeart, MAX_HEARTS, regenerate, type HeartsState } from "./hearts";
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
    }
  | {
      id: string;
      /** set the user's daily XP goal; last-write-wins, no XP/heart/streak effect */
      type: "goal_set";
      occurredAt: number;
      goalXp: number;
    };

/** Default daily XP goal until the user sets one via a goal_set event. */
export const DEFAULT_DAILY_GOAL_XP = 30;

export interface UserProgress {
  xpTotal: number;
  /** first-time completions, for the course map */
  completedLessonIds: string[];
  streak: StreakState;
  hearts: HeartsState;
  /** count of every lesson_completed event, including practice replays */
  lessonsCompleted: number;
  /** count of lesson_completed events with perfect === true */
  perfectLessons: number;
  /** count of practice-replay completions */
  practiceCount: number;
  /** localDayKey → XP earned that day (clamped ts + timeZone, like streaks) */
  xpByDay: Record<string, number>;
  /** highest streak.count ever reached while folding the stream */
  longestStreak: number;
  /** current daily XP goal (DEFAULT_DAILY_GOAL_XP until a goal_set event) */
  dailyGoalXp: number;
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
  // Tie-break equal timestamps by id so the fold is deterministic for the
  // same event *set* regardless of input order (goal_set is last-write-wins).
  const sorted = [...events].sort(
    (a, b) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const completed = new Set<string>(initial?.completedLessonIds ?? []);
  let xpTotal = initial?.xpTotal ?? 0;
  let streak = initial?.streak ?? emptyStreak;
  let hearts = initial?.hearts ?? fullHearts(Math.min(sorted[0]?.occurredAt ?? now, now));
  // New fields read with ?? fallbacks so an older server baseline (missing
  // them) still overlays sensibly.
  let lessonsCompleted = initial?.lessonsCompleted ?? initial?.completedLessonIds.length ?? 0;
  let perfectLessons = initial?.perfectLessons ?? 0;
  let practiceCount = initial?.practiceCount ?? 0;
  const xpByDay: Record<string, number> = { ...(initial?.xpByDay ?? {}) };
  let longestStreak = initial?.longestStreak ?? initial?.streak.count ?? streak.count;
  let dailyGoalXp = initial?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;

  // `id` is the idempotency key (OFF-03): the same event may reach a stream
  // twice (client retry after a dropped response) and must count once.
  const seenIds = new Set<string>();

  for (const ev of sorted) {
    if (seenIds.has(ev.id)) continue;
    seenIds.add(ev.id);
    // clamp future timestamps (clock tampering / skew) to now (OFF-05)
    const t = Math.min(ev.occurredAt, now);
    switch (ev.type) {
      case "lesson_completed": {
        xpTotal += ev.xp;
        const day = localDayKey(t, timeZone);
        xpByDay[day] = (xpByDay[day] ?? 0) + ev.xp;
        streak = applyCompletionDay(streak, day);
        if (streak.count > longestStreak) longestStreak = streak.count;
        lessonsCompleted++;
        if (ev.perfect) perfectLessons++;
        if (!ev.practice) completed.add(ev.lessonId);
        else {
          practiceCount++;
          hearts = addHearts(hearts, 1, t);
        }
        break;
      }
      case "hearts_lost": {
        // losing more than MAX_HEARTS changes nothing; clamp hostile counts
        const n = Math.min(ev.count, MAX_HEARTS);
        for (let i = 0; i < n; i++) hearts = loseHeart(hearts, t);
        break;
      }
      case "hearts_refilled":
        hearts = addHearts(hearts, ev.amount, t);
        break;
      case "goal_set":
        // sorted by occurredAt, so the last valid goal_set wins (last-write-wins);
        // junk goals (NaN / zero / negative) would make goalMet trivially true
        if (Number.isFinite(ev.goalXp) && ev.goalXp > 0) dailyGoalXp = ev.goalXp;
        break;
    }
  }

  return {
    xpTotal,
    completedLessonIds: [...completed],
    streak,
    hearts: regenerate(hearts, now),
    lessonsCompleted,
    perfectLessons,
    practiceCount,
    xpByDay,
    longestStreak,
    dailyGoalXp,
  };
}

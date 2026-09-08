import { addHearts, fullHearts, loseHeart, MAX_HEARTS, regenerate, type HeartsState } from "./hearts";
import { emptyDayStats, pendingQuestRewards, type DayStats } from "./quests";
import { applyCompletionDay, emptyStreak, localDayKey, type StreakState } from "./streak";
import { PRACTICE_XP } from "./xp";

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
      /** exercises answered wrong at least once this session (REV-01) */
      missedExerciseIds?: string[];
      /** exercises solved without a miss — clears them from the review queue */
      masteredExerciseIds?: string[];
      /** longest consecutive-correct run in the session, for combo quests (GAM) */
      maxCombo?: number;
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
    }
  | {
      id: string;
      /**
       * The learner placed into a difficulty tier instead of working up to it.
       * Unlocks that tier's first lesson; grants no XP and completes nothing,
       * so a replayed or duplicated event is harmless.
       */
      type: "tier_started";
      occurredAt: number;
      tierId: string;
    };

/** Default daily XP goal until the user sets one via a goal_set event. */
export const DEFAULT_DAILY_GOAL_XP = 30;

/**
 * How many days of per-day quest counters to keep. Quests only ever read
 * today, so older entries are dead weight in the /sync baseline; the
 * long-term XP history lives in xpByDay, which stays complete.
 */
export const DAY_STATS_KEPT = 90;

/** Hostile clients can inflate a session's combo; bound what one can claim. */
const MAX_CLAIMABLE_COMBO = 500;

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
  /** localDayKey → XP earned that day including quest rewards (clamped ts + timeZone, like streaks) */
  xpByDay: Record<string, number>;
  /**
   * localDayKey → the counters daily quests are scored against, most recent
   * DAY_STATS_KEPT days. Quest rewards are recorded here as they are earned,
   * which is also what makes crediting them idempotent across re-folds.
   */
  dayStats: Record<string, DayStats>;
  /** highest streak.count ever reached while folding the stream */
  longestStreak: number;
  /** current daily XP goal (DEFAULT_DAILY_GOAL_XP until a goal_set event) */
  dailyGoalXp: number;
  /** difficulty tiers the learner placed into directly (tier_started events) */
  unlockedTierIds: string[];
  /**
   * Exercises whose most recent attempt included a miss, oldest first — the
   * review queue (REV-01). An exercise leaves when a later session masters it.
   */
  weakExerciseIds: string[];
  /** how many weak exercises the user has cleared by mastering them later */
  mistakesCleared: number;
}

/** Drop all but the most recent DAY_STATS_KEPT days (keys sort chronologically). */
function trimDayStats(stats: Record<string, DayStats>): Record<string, DayStats> {
  const keys = Object.keys(stats);
  if (keys.length <= DAY_STATS_KEPT) return stats;
  const kept = keys.sort().slice(-DAY_STATS_KEPT);
  return Object.fromEntries(kept.map((k) => [k, stats[k]!]));
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
  let lessonsCompleted = initial?.lessonsCompleted ?? initial?.completedLessonIds?.length ?? 0;
  let perfectLessons = initial?.perfectLessons ?? 0;
  let practiceCount = initial?.practiceCount ?? 0;
  const xpByDay: Record<string, number> = { ...(initial?.xpByDay ?? {}) };
  const dayStats: Record<string, DayStats> = { ...(initial?.dayStats ?? {}) };
  let longestStreak = initial?.longestStreak ?? initial?.streak?.count ?? streak.count;
  let dailyGoalXp = initial?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;
  const unlockedTiers = new Set<string>(initial?.unlockedTierIds ?? []);
  // insertion-ordered: oldest weak exercise first, deterministic given the
  // sorted fold (review sessions serve the longest-standing mistakes first)
  const weak = new Set<string>(initial?.weakExerciseIds ?? []);
  let mistakesCleared = initial?.mistakesCleared ?? 0;

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
        // Completing a lesson that is already finished is a *replay*, whatever
        // the event claims. Trusting the flag let any client farm unlimited XP
        // by re-sending completions of one easy lesson with practice:false —
        // the per-event xp clamp caps each event but not the repetition.
        // Deriving it here fixes clients and server at once (both fold with
        // this reducer), and keeps the stored event as the raw client claim.
        const replay = ev.practice === true || completed.has(ev.lessonId);
        const xp = replay ? Math.min(ev.xp, PRACTICE_XP) : ev.xp;
        xpTotal += xp;
        const day = localDayKey(t, timeZone);
        xpByDay[day] = (xpByDay[day] ?? 0) + xp;
        const stats: DayStats = { ...(dayStats[day] ?? emptyDayStats) };
        stats.lessonXp += xp;
        stats.lessons += 1;
        streak = applyCompletionDay(streak, day);
        if (streak.count > longestStreak) longestStreak = streak.count;
        lessonsCompleted++;
        // perfect practice runs of an already-learned lesson would farm the
        // perfect-lesson achievements; only first-time perfection counts
        if (ev.perfect && !replay) {
          perfectLessons++;
          stats.perfect += 1;
        }
        if (!replay) completed.add(ev.lessonId);
        else {
          practiceCount++;
          stats.practice += 1;
          hearts = addHearts(hearts, 1, t);
        }
        // mastered first, then missed: if a hostile event lists an id in both,
        // "still weak" is the safe reading
        for (const exId of ev.masteredExerciseIds ?? []) {
          if (weak.delete(exId)) {
            mistakesCleared++;
            stats.mistakesCleared += 1;
          }
        }
        for (const exId of ev.missedExerciseIds ?? []) weak.add(exId);
        if (typeof ev.maxCombo === "number" && Number.isFinite(ev.maxCombo))
          stats.maxCombo = Math.max(stats.maxCombo, Math.min(ev.maxCombo, MAX_CLAIMABLE_COMBO));
        // Quest rewards are credited here rather than claimed by their own
        // event, so there is nothing for a client to forge: the server's fold
        // reaches the same conclusion. Targets read stats.lessonXp only, never
        // the reward XP below, so a reward can't complete the quest that paid it.
        const reward = pendingQuestRewards(day, stats);
        if (reward.ids.length > 0) {
          stats.questIds = [...stats.questIds, ...reward.ids];
          stats.questXp += reward.xp;
          xpTotal += reward.xp;
          xpByDay[day] = (xpByDay[day] ?? 0) + reward.xp;
        }
        dayStats[day] = stats;
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
      case "tier_started":
        // placement is additive and idempotent — a tier never re-locks
        if (typeof ev.tierId === "string" && ev.tierId !== "") unlockedTiers.add(ev.tierId);
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
    dayStats: trimDayStats(dayStats),
    longestStreak,
    dailyGoalXp,
    unlockedTierIds: [...unlockedTiers],
    weakExerciseIds: [...weak],
    mistakesCleared,
  };
}

/** Today's quest counters, with an empty day when nothing has happened yet. */
export function todayStats(progress: UserProgress, timeZone: string, now: number): DayStats {
  return progress.dayStats?.[localDayKey(now, timeZone)] ?? emptyDayStats;
}

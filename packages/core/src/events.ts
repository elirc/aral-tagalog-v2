import { addHearts, fullHearts, loseHeart, MAX_HEARTS, regenerate, type HeartsState } from "./hearts";
import { applyCompletionDay, emptyStreak, localDayKey, type StreakState } from "./streak";
import { dueReviewIds, REVIEW_INTERVALS_MS, REVIEW_MAX_BOX, type ReviewItem } from "./review";
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
    }
  | {
      id: string;
      type: "hearts_lost";
      occurredAt: number;
      /** hearts to deduct; 0 for a miss that cost none (practice / review runs) */
      count: number;
      /**
       * The exercise whose miss cost these hearts. Schedules it for review
       * the moment it happens, so a session that never reaches
       * lesson_completed (out of hearts, app closed) still leaves its
       * mistakes behind. Absent on events from older clients.
       */
      exerciseId?: string;
    }
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
  /**
   * Exercises due for review as of the `now` this progress was folded at,
   * longest-overdue first — the review queue (REV-01). Derived from
   * `reviewItems`; a mastered exercise leaves until its next interval elapses.
   */
  weakExerciseIds: string[];
  /**
   * How many missed exercises the user has cleared by mastering them later.
   * Counts the first clear after each miss (box 0 → 1), not the later
   * spaced repetitions of the same exercise.
   */
  mistakesCleared: number;
  /**
   * Spaced-review schedule: every exercise missed and not yet graduated,
   * due or not (see REVIEW_INTERVALS_MS). Independent of `now`, so it is
   * what a baseline carries forward; `weakExerciseIds` is its due slice.
   */
  reviewItems: Record<string, ReviewItem>;
}

/** Read a baseline's schedule defensively: it may be legacy, or hand-edited. */
function seedReview(initial: UserProgress | undefined): Map<string, ReviewItem> {
  const review = new Map<string, ReviewItem>();
  const stored = initial?.reviewItems;
  if (stored && typeof stored === "object") {
    for (const [id, it] of Object.entries(stored)) {
      if (!it || !Number.isFinite(it.box) || !Number.isFinite(it.dueAt)) continue;
      const box = Math.min(Math.max(Math.floor(it.box), 0), REVIEW_MAX_BOX);
      review.set(id, { box, dueAt: it.dueAt });
    }
    return review;
  }
  // Legacy baseline (older server / cached snapshot): only the flat queue.
  // Everything in it was awaiting a first clear — box 0. dueAt = position
  // keeps the old queue order and sorts ahead of any real timestamp.
  const legacy = initial?.weakExerciseIds;
  if (Array.isArray(legacy)) {
    legacy.forEach((id, i) => {
      if (typeof id === "string" && !review.has(id)) review.set(id, { box: 0, dueAt: i });
    });
  }
  return review;
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
  let longestStreak = initial?.longestStreak ?? initial?.streak?.count ?? streak.count;
  let dailyGoalXp = initial?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;
  const review = seedReview(initial);
  let mistakesCleared = initial?.mistakesCleared ?? 0;

  const miss = (exId: string, t: number) => {
    // already awaiting a first clear: keep its original due time, so the
    // longest-standing mistake stays at the front of the queue
    if (review.get(exId)?.box === 0) return;
    review.set(exId, { box: 0, dueAt: t });
  };
  const master = (exId: string, t: number) => {
    const cur = review.get(exId);
    // Only a review that was *due* advances the schedule. Otherwise replaying
    // a lesson five times in a minute would graduate its exercises without
    // any of the spacing the boxes exist to enforce.
    if (!cur || cur.dueAt > t) return;
    if (cur.box === 0) mistakesCleared++;
    const box = cur.box + 1;
    if (box > REVIEW_MAX_BOX) review.delete(exId);
    else review.set(exId, { box, dueAt: t + REVIEW_INTERVALS_MS[box - 1]! });
  };

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
        streak = applyCompletionDay(streak, day);
        if (streak.count > longestStreak) longestStreak = streak.count;
        lessonsCompleted++;
        // perfect practice runs of an already-learned lesson would farm the
        // perfect-lesson achievements; only first-time perfection counts
        if (ev.perfect && !replay) perfectLessons++;
        if (!replay) completed.add(ev.lessonId);
        else {
          practiceCount++;
          hearts = addHearts(hearts, 1, t);
        }
        // if a hostile event lists an id as both missed and mastered,
        // "still weak" is the safe reading: the miss wins and nothing clears
        const missed = new Set(ev.missedExerciseIds ?? []);
        for (const exId of ev.masteredExerciseIds ?? []) {
          if (!missed.has(exId)) master(exId, t);
        }
        for (const exId of missed) miss(exId, t);
        break;
      }
      case "hearts_lost": {
        // losing more than MAX_HEARTS changes nothing; clamp hostile counts
        const n = Math.min(ev.count, MAX_HEARTS);
        for (let i = 0; i < n; i++) hearts = loseHeart(hearts, t);
        // the miss is recorded when it happens, not at lesson_completed —
        // which a learner who runs out of hearts never reaches
        if (typeof ev.exerciseId === "string" && ev.exerciseId) miss(ev.exerciseId, t);
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

  // keyed in id order so the same schedule always serializes the same way
  const reviewItems: Record<string, ReviewItem> = {};
  for (const id of [...review.keys()].sort()) reviewItems[id] = review.get(id)!;

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
    weakExerciseIds: dueReviewIds({ reviewItems }, now),
    mistakesCleared,
    reviewItems,
  };
}

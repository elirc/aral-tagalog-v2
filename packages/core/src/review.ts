import type { Lesson, Unit } from "./types";
import { PRACTICE_XP } from "./xp";

/**
 * Review mode (REV-01, closes SPEC OQ-02): sessions report which exercises
 * were missed / mastered, the reducer keeps a per-user spaced-review schedule,
 * and this module turns what is due into a playable synthetic lesson. Both
 * clients render it with the ordinary LessonPlayer — a review session is just
 * a practice lesson whose exercises come from past mistakes.
 */

const DAY_MS = 86_400_000;

/**
 * Leitner schedule. A missed exercise sits in box 0, due at once. Each time
 * it is mastered *while due* it moves up a box and comes back after that
 * box's interval: REVIEW_INTERVALS_MS[box - 1]. Mastering it in the last box
 * graduates it (it leaves the schedule). Any miss sends it back to box 0.
 */
export const REVIEW_INTERVALS_MS: readonly number[] = [1, 3, 7, 21].map((d) => d * DAY_MS);

/** highest box an exercise can sit in before graduating */
export const REVIEW_MAX_BOX = REVIEW_INTERVALS_MS.length;

export interface ReviewItem {
  /** 0 = just missed; 1..REVIEW_MAX_BOX = mastered that many times in a row */
  box: number;
  /** epoch ms from which the exercise is due for review (same clock as occurredAt) */
  dueAt: number;
}

type ReviewSource = { reviewItems?: Record<string, ReviewItem>; weakExerciseIds?: string[] };

/**
 * Ids due for review at `now`, longest-overdue first (ties break by id, so
 * the order depends only on the schedule, never on how it was stored).
 *
 * `reduceEvents(..., now)` already returns this as `weakExerciseIds`; call it
 * directly to re-check a progress object you are holding as time passes,
 * without re-folding. A legacy progress object with no `reviewItems` answers
 * with its `weakExerciseIds` unchanged.
 */
export function dueReviewIds(progress: ReviewSource, now: number): string[] {
  const items = progress.reviewItems;
  if (!items) return [...(progress.weakExerciseIds ?? [])];
  return Object.entries(items)
    .filter(([, it]) => it.dueAt <= now)
    .sort(([a, x], [b, y]) => x.dueAt - y.dueAt || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
}

/**
 * When the next not-yet-due exercise comes due (epoch ms), or null if nothing
 * is waiting. For "next review in 2 days" copy when the due queue is empty.
 */
export function nextReviewAt(progress: ReviewSource, now: number): number | null {
  let next: number | null = null;
  for (const it of Object.values(progress.reviewItems ?? {})) {
    if (it.dueAt > now && (next === null || it.dueAt < next)) next = it.dueAt;
  }
  return next;
}

/** lessonId used on review completions — never a real lesson, never unlocks anything */
export const REVIEW_LESSON_ID = "review";

/** cap per session so a big backlog stays a short, winnable exercise set */
export const REVIEW_MAX_EXERCISES = 10;

/**
 * Build a practice lesson from the user's due exercises (pass
 * `progress.weakExerciseIds`), or null when there is nothing to review.
 * Exercises come back in the order given (longest-overdue first); ids not present in the current bundle are skipped, so a
 * content update can never wedge review with a stale id.
 */
export function buildReviewLesson(
  units: Unit[],
  weakExerciseIds: string[],
  max = REVIEW_MAX_EXERCISES,
): Lesson | null {
  if (weakExerciseIds.length === 0) return null;
  const wanted = new Set(weakExerciseIds);
  const byId = new Map<string, Lesson["exercises"][number]>();
  for (const unit of units)
    for (const lesson of unit.lessons)
      for (const ex of lesson.exercises) if (wanted.has(ex.id)) byId.set(ex.id, ex);
  const exercises = weakExerciseIds
    .map((id) => byId.get(id))
    .filter((ex): ex is Lesson["exercises"][number] => ex !== undefined)
    .slice(0, max);
  if (exercises.length === 0) return null;
  return { id: REVIEW_LESSON_ID, title: "Review mistakes", xp: PRACTICE_XP, exercises };
}

/**
 * Linear unlock: a lesson is playable once every lesson before it (across
 * units, in course order) is completed. Shared by both clients so the course
 * map and the lesson route can never disagree.
 */
export function isLessonUnlocked(units: Unit[], lessonId: string, completedLessonIds: string[]): boolean {
  const done = new Set(completedLessonIds);
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (lesson.id === lessonId) return true;
      if (!done.has(lesson.id)) return false;
    }
  }
  return false;
}

import type { Lesson, Unit } from "./types";
import { isTierUnlocked, tierLessonIds, tierOfLesson, type TierUnlockContext } from "./tiers";
import { PRACTICE_XP } from "./xp";

/**
 * Review mode (REV-01, closes SPEC OQ-02): sessions report which exercises
 * were missed / mastered, the reducer keeps a per-user weak-exercise queue,
 * and this module turns that queue into a playable synthetic lesson. Both
 * clients render it with the ordinary LessonPlayer — a review session is just
 * a practice lesson whose exercises come from past mistakes.
 */

/** lessonId used on review completions — never a real lesson, never unlocks anything */
export const REVIEW_LESSON_ID = "review";

/** cap per session so a big backlog stays a short, winnable exercise set */
export const REVIEW_MAX_EXERCISES = 10;

/**
 * Build a practice lesson from the user's weak exercises, or null when there
 * is nothing to review. Exercises come back in weak-queue order (oldest
 * mistakes first); ids not present in the current bundle are skipped, so a
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
 *
 * With difficulty tiers the sequence is scoped to the lesson's own tier: the
 * tier must be open (first tier, placed into, or the previous one finished)
 * and every earlier lesson *within that tier* must be done. That is what makes
 * placement work — jumping into Conversational must not require Foundations.
 * Pass no `ctx` (or a bundle without tiers) for the flat behaviour.
 */
export function isLessonUnlocked(
  units: Unit[],
  lessonId: string,
  completedLessonIds: string[],
  ctx: TierUnlockContext = {},
): boolean {
  const done = new Set(completedLessonIds);
  const tierId = (ctx.tiers?.length ?? 0) > 0 ? tierOfLesson(units, lessonId) : null;
  if (tierId === null) {
    // flat course, or a unit that names no tier: order across the whole course
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        if (lesson.id === lessonId) return true;
        if (!done.has(lesson.id)) return false;
      }
    }
    return false;
  }
  if (!isTierUnlocked(units, tierId, completedLessonIds, ctx)) return false;
  for (const id of tierLessonIds(units, tierId)) {
    if (id === lessonId) return true;
    if (!done.has(id)) return false;
  }
  return false;
}

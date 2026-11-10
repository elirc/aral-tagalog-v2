import {
  buildReviewLesson,
  dueReviewIds,
  isLessonUnlocked as unlockedInUnits,
  type CourseBundle,
  type Lesson,
  type Unit,
  type UserProgress,
} from "@aral/core";
import bundleJson from "@aral/content/bundle";

/**
 * The web app ships the compiled bundle at build time (simplest online-first
 * setup, ARCH-05). Mobile downloads it at runtime instead; content updates on
 * web arrive with the next deploy.
 */
export const bundle = bundleJson as unknown as CourseBundle;

export function findLesson(lessonId: string): { lesson: Lesson; unitTitle: string } | null {
  for (const unit of bundle.units) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, unitTitle: unit.title };
  }
  return null;
}

/** lessons unlock in order: everything up to the first uncompleted lesson per course */
export function isLessonUnlocked(lessonId: string, completed: string[]): boolean {
  return unlockedInUnits(bundle.units, lessonId, completed);
}

/** The learner's next lesson: the first one not in `done`, in course order. */
export function findNextLesson(done: Set<string>): { unit: Unit; lesson: Lesson; unitIndex: number } | null {
  for (let ui = 0; ui < bundle.units.length; ui++) {
    const unit = bundle.units[ui]!;
    const lesson = unit.lessons.find((l) => !done.has(l.id));
    if (lesson) return { unit, lesson, unitIndex: ui };
  }
  return null;
}

/**
 * How many exercises are due for review right now. Counts only ids that still
 * exist in this bundle version, so the number always matches what
 * /lesson/review can actually serve (0 → the route says "nothing to review").
 */
export function dueReviewCount(progress: UserProgress, now: number): number {
  return (
    buildReviewLesson(bundle.units, dueReviewIds(progress, now), Number.MAX_SAFE_INTEGER)?.exercises
      .length ?? 0
  );
}

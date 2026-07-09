import type { CourseBundle, Lesson } from "@aral/core";
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
  const done = new Set(completed);
  for (const unit of bundle.units) {
    for (const lesson of unit.lessons) {
      if (lesson.id === lessonId) return true;
      if (!done.has(lesson.id)) return false; // first locked lesson found before target
    }
  }
  return false;
}

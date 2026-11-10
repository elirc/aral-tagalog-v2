import type { Lesson, Unit } from "@aral/core";

export interface NextLesson {
  unit: Unit;
  lesson: Lesson;
  unitIndex: number;
}

/**
 * The first uncompleted lesson in course order, or null once the course is
 * finished. Shared by the course map ("Jump back in") and the lesson-complete
 * screen ("Next lesson") so the two can never point at different lessons.
 */
export function findNextLesson(units: Unit[], completed: Iterable<string>): NextLesson | null {
  const done = completed instanceof Set ? (completed as Set<string>) : new Set(completed);
  for (let ui = 0; ui < units.length; ui++) {
    const unit = units[ui]!;
    const lesson = unit.lessons.find((l) => !done.has(l.id));
    if (lesson) return { unit, lesson, unitIndex: ui };
  }
  return null;
}

import type { Lesson } from "./types";

export const DEFAULT_LESSON_XP = 10;
export const PERFECT_BONUS_XP = 5;

export function lessonXp(lesson: Pick<Lesson, "xp">, perfect: boolean): number {
  return (lesson.xp || DEFAULT_LESSON_XP) + (perfect ? PERFECT_BONUS_XP : 0);
}

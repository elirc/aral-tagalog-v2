import type { Lesson } from "./types";

export const DEFAULT_LESSON_XP = 10;
export const PERFECT_BONUS_XP = 5;

/**
 * Practice replays earn a flat, smaller amount — full lesson XP on replays
 * would let one early lesson farm unlimited XP, levels, and goal progress.
 * The server clamps practice completions to this value too (GAM cheat-proofing).
 */
export const PRACTICE_XP = 5;

export function lessonXp(lesson: Pick<Lesson, "xp">, perfect: boolean): number {
  return (lesson.xp || DEFAULT_LESSON_XP) + (perfect ? PERFECT_BONUS_XP : 0);
}

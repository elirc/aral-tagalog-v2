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

/**
 * Combo (GAM): consecutive correct answers inside one session. From the
 * COMBO_MIN-th correct answer in a row, each further correct answer adds 1 XP,
 * up to MAX_COMBO_BONUS_XP for the session. A wrong answer resets the run.
 *
 * The cap is what keeps the reward bounded and server-checkable: /sync clamps
 * a first-time completion to lessonXp(lesson, perfect) + MAX_COMBO_BONUS_XP.
 * Practice replays earn PRACTICE_XP flat and no combo bonus, so a completed
 * lesson can't be farmed by chaining perfect replays.
 */
export const COMBO_MIN = 3;
export const MAX_COMBO_BONUS_XP = 10;

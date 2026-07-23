import { describe, expect, it } from "vitest";
import { DEFAULT_LESSON_XP, lessonXp, PERFECT_BONUS_XP, PRACTICE_XP } from "./xp";

describe("lessonXp", () => {
  it("awards authored xp, plus the bonus on a perfect run", () => {
    expect(lessonXp({ xp: 12 }, false)).toBe(12);
    expect(lessonXp({ xp: 12 }, true)).toBe(12 + PERFECT_BONUS_XP);
  });

  it("falls back to the default when a lesson has no xp value", () => {
    expect(lessonXp({ xp: 0 }, false)).toBe(DEFAULT_LESSON_XP);
  });

  it("keeps practice xp below any authored first-time award", () => {
    // the anti-farming premise: replaying can never beat first-time completion
    expect(PRACTICE_XP).toBeLessThan(DEFAULT_LESSON_XP);
  });
});

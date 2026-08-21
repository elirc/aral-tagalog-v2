import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, earnedAchievementIds, type AchievementCourseUnit } from "./achievements";
import { DEFAULT_DAILY_GOAL_XP, type UserProgress } from "./events";
import { fullHearts } from "./hearts";

function progress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    xpTotal: 0,
    completedLessonIds: [],
    streak: { count: 0, lastDay: null },
    hearts: fullHearts(0),
    lessonsCompleted: 0,
    perfectLessons: 0,
    practiceCount: 0,
    xpByDay: {},
    dayStats: {},
    longestStreak: 0,
    dailyGoalXp: DEFAULT_DAILY_GOAL_XP,
    unlockedTierIds: [],
    weakExerciseIds: [],
    mistakesCleared: 0,
    ...overrides,
  };
}

describe("ACHIEVEMENTS catalog", () => {
  it("has unique ids and valid tiers", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect([1, 2, 3]).toContain(a.tier);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("earnedAchievementIds", () => {
  it("earns nothing for a brand-new user", () => {
    expect(earnedAchievementIds(progress())).toEqual([]);
  });

  it("earns the first-lesson badge on one completion", () => {
    expect(earnedAchievementIds(progress({ lessonsCompleted: 1 }))).toContain("first_lesson");
  });

  it("earns lesson-count tiers cumulatively", () => {
    expect(earnedAchievementIds(progress({ lessonsCompleted: 10 }))).toEqual(
      expect.arrayContaining(["first_lesson", "lessons_10"]),
    );
    expect(earnedAchievementIds(progress({ lessonsCompleted: 10 }))).not.toContain("lessons_50");
    expect(earnedAchievementIds(progress({ lessonsCompleted: 50 }))).toEqual(
      expect.arrayContaining(["first_lesson", "lessons_10", "lessons_50"]),
    );
  });

  it("earns perfect badges", () => {
    expect(earnedAchievementIds(progress({ perfectLessons: 1 }))).toContain("first_perfect");
    expect(earnedAchievementIds(progress({ perfectLessons: 1 }))).not.toContain("perfects_10");
    expect(earnedAchievementIds(progress({ perfectLessons: 10 }))).toContain("perfects_10");
  });

  it("earns the first-practice badge", () => {
    expect(earnedAchievementIds(progress({ practiceCount: 0 }))).not.toContain("first_practice");
    expect(earnedAchievementIds(progress({ practiceCount: 1 }))).toContain("first_practice");
  });

  it("earns the mistakes-cleared badge at 10 cleared reviews", () => {
    expect(earnedAchievementIds(progress({ mistakesCleared: 9 }))).not.toContain("mistakes_cleared_10");
    expect(earnedAchievementIds(progress({ mistakesCleared: 10 }))).toContain("mistakes_cleared_10");
  });

  it("earns course completion only when every unit's lessons are done", () => {
    // one whole unit done (earns unit_complete) is not the whole course
    expect(earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2"] }), units)).not.toContain(
      "course_complete",
    );
    // one lesson short of the end still doesn't count
    expect(
      earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2", "l3"] }), units),
    ).not.toContain("course_complete");
    expect(
      earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2", "l3", "l4"] }), units),
    ).toContain("course_complete");
  });

  it("never earns course completion without the course structure", () => {
    expect(
      earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2", "l3", "l4"] })),
    ).not.toContain("course_complete");
  });

  it("earns streak badges from longestStreak, not the current streak", () => {
    // current streak reset to 1, but longest was 7
    const p = progress({ streak: { count: 1, lastDay: "2026-07-14" }, longestStreak: 7 });
    const earned = earnedAchievementIds(p);
    expect(earned).toEqual(expect.arrayContaining(["streak_3", "streak_7"]));
    expect(earned).not.toContain("streak_30");
    expect(earnedAchievementIds(progress({ longestStreak: 30 }))).toContain("streak_30");
  });

  it("earns XP tiers", () => {
    expect(earnedAchievementIds(progress({ xpTotal: 100 }))).toContain("xp_100");
    expect(earnedAchievementIds(progress({ xpTotal: 100 }))).not.toContain("xp_500");
    expect(earnedAchievementIds(progress({ xpTotal: 500 }))).toContain("xp_500");
    expect(earnedAchievementIds(progress({ xpTotal: 2000 }))).toContain("xp_2000");
  });

  const units: AchievementCourseUnit[] = [
    { id: "u1", lessons: [{ id: "l1" }, { id: "l2" }] },
    { id: "u2", lessons: [{ id: "l3" }, { id: "l4" }] },
  ];

  it("stays locked for unit completion without the course param", () => {
    expect(earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2"] }))).not.toContain(
      "unit_complete",
    );
  });

  it("earns unit completion only when a whole unit is covered", () => {
    expect(
      earnedAchievementIds(progress({ completedLessonIds: ["l1"] }), units),
    ).not.toContain("unit_complete");
    expect(
      earnedAchievementIds(progress({ completedLessonIds: ["l1", "l2"] }), units),
    ).toContain("unit_complete");
  });

  it("ignores empty units for unit completion", () => {
    const emptyUnits: AchievementCourseUnit[] = [{ id: "u0", lessons: [] }];
    expect(earnedAchievementIds(progress(), emptyUnits)).not.toContain("unit_complete");
  });

  it("returns ids in ACHIEVEMENTS definition order", () => {
    const p = progress({
      lessonsCompleted: 200,
      perfectLessons: 12,
      practiceCount: 3,
      longestStreak: 120,
      xpTotal: 5000,
      completedLessonIds: ["l1", "l2", "l3", "l4"],
      mistakesCleared: 12,
    });
    const earned = earnedAchievementIds(p, units);
    const order = ACHIEVEMENTS.map((a) => a.id);
    const expected = order.filter((id) => earned.includes(id));
    expect(earned).toEqual(expected);
    // this maxed-out user unlocks everything
    expect(earned).toEqual(order);
  });

  it("tolerates a progress object missing the new fields (defensive reads)", () => {
    const legacy = {
      xpTotal: 600,
      completedLessonIds: ["l1", "l2"],
      streak: { count: 8, lastDay: "2026-07-14" },
      hearts: fullHearts(0),
    } as unknown as UserProgress;
    const earned = earnedAchievementIds(legacy, units);
    // xp + unit still fire; streak falls back to streak.count
    expect(earned).toEqual(expect.arrayContaining(["xp_100", "xp_500", "streak_3", "streak_7", "unit_complete"]));
    // count-based ones without data stay locked
    expect(earned).not.toContain("first_lesson");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_GOAL_XP, reduceEvents, type ProgressEvent, type UserProgress } from "./events";
import { HEART_REGEN_MS, MAX_HEARTS } from "./hearts";

const TZ = "Asia/Manila";
const T0 = Date.UTC(2026, 6, 8, 10, 0, 0); // midday July 8 in Manila

describe("reduceEvents", () => {
  it("derives xp, completions, streak, and hearts from a stream", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 2 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: false, xp: 10 },
      { id: "3", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 86_400_000, perfect: true, xp: 15 },
    ];
    const p = reduceEvents(events, TZ, T0 + 86_400_000 + 1000);
    expect(p.xpTotal).toBe(25);
    expect(p.completedLessonIds.sort()).toEqual(["l1", "l2"]);
    expect(p.streak.count).toBe(2);
    // 2 hearts lost, then a full day of regen -> back to max
    expect(p.hearts.hearts).toBe(MAX_HEARTS);
  });

  it("is order-independent (late offline batches)", () => {
    const events: ProgressEvent[] = [
      { id: "b", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 86_400_000, perfect: false, xp: 10 },
      { id: "a", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10 },
    ];
    expect(reduceEvents(events, TZ, T0 + 2 * 86_400_000).streak.count).toBe(2);
  });

  it("practice completions refill a heart, not first-time completion", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 3 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: false, xp: 5, practice: true },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.completedLessonIds).toEqual([]);
    expect(p.hearts.hearts).toBe(3);
  });

  it("clamps future timestamps to now", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0 + 999 * HEART_REGEN_MS, count: 1 },
    ];
    const p = reduceEvents(events, TZ, T0);
    expect(p.hearts.hearts).toBe(MAX_HEARTS - 1);
  });

  it("overlays local events on a server baseline", () => {
    const baseline = reduceEvents(
      [{ id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10 }],
      TZ,
      T0 + 1000,
    );
    const local: ProgressEvent[] = [
      { id: "2", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 86_400_000, perfect: true, xp: 15 },
    ];
    const p = reduceEvents(local, TZ, T0 + 86_400_000 + 1000, baseline);
    expect(p.xpTotal).toBe(25);
    expect(p.completedLessonIds.sort()).toEqual(["l1", "l2"]);
    expect(p.streak.count).toBe(2);
  });

  it("full ad refill restores max hearts", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 5 },
      { id: "2", type: "hearts_refilled", occurredAt: T0 + 1000, amount: "full", source: "ad" },
    ];
    expect(reduceEvents(events, TZ, T0 + 2000).hearts.hearts).toBe(MAX_HEARTS);
  });

  it("counts an event with a repeated id only once (client retry idempotency)", () => {
    const ev: ProgressEvent = {
      id: "dup-1",
      type: "lesson_completed",
      lessonId: "l1",
      occurredAt: T0,
      perfect: true,
      xp: 10,
    };
    const p = reduceEvents([ev, { ...ev }], TZ, T0 + 1000);
    expect(p.xpTotal).toBe(10);
    expect(p.lessonsCompleted).toBe(1);
    expect(p.perfectLessons).toBe(1);
  });

  it("resolves equal-occurredAt events deterministically regardless of input order", () => {
    const a: ProgressEvent = { id: "aaa", type: "goal_set", occurredAt: T0, goalXp: 20 };
    const b: ProgressEvent = { id: "bbb", type: "goal_set", occurredAt: T0, goalXp: 50 };
    const p1 = reduceEvents([a, b], TZ, T0 + 1000);
    const p2 = reduceEvents([b, a], TZ, T0 + 1000);
    expect(p1.dailyGoalXp).toBe(p2.dailyGoalXp);
    expect(p1.dailyGoalXp).toBe(50); // id tie-break: "bbb" sorts after "aaa"
  });

  it("clamps hostile hearts_lost counts instead of looping unbounded", () => {
    const p = reduceEvents(
      [{ id: "1", type: "hearts_lost", occurredAt: T0, count: 1_000_000 }],
      TZ,
      T0 + 1000,
    );
    expect(p.hearts.hearts).toBe(0);
  });

  it("counts lessons, perfects, and practice replays", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10 },
      { id: "2", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 1000, perfect: true, xp: 15 },
      { id: "3", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 2000, perfect: false, xp: 5, practice: true },
    ];
    const p = reduceEvents(events, TZ, T0 + 3000);
    expect(p.lessonsCompleted).toBe(3);
    expect(p.perfectLessons).toBe(1);
    expect(p.practiceCount).toBe(1);
    expect(p.completedLessonIds.sort()).toEqual(["l1", "l2"]);
  });
});

describe("reduceEvents — gamification fields", () => {
  it("accumulates xpByDay across days and timezones", () => {
    // 2026-07-08 20:00 UTC → July 9 04:00 in Manila (+8), July 8 13:00 in LA (-7):
    // a timestamp that lands on different calendar days in the two zones.
    const tEve = Date.UTC(2026, 6, 8, 20, 0, 0);
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: tEve, perfect: false, xp: 10 },
      { id: "2", type: "lesson_completed", lessonId: "l2", occurredAt: tEve + 1000, perfect: false, xp: 5 },
      { id: "3", type: "lesson_completed", lessonId: "l3", occurredAt: tEve + 86_400_000, perfect: false, xp: 20 },
    ];
    const p = reduceEvents(events, TZ, tEve + 86_400_000 + 1000);
    expect(p.xpByDay).toEqual({ "2026-07-09": 15, "2026-07-10": 20 });

    // Same events in Los Angeles bucket into the prior calendar day.
    const pLA = reduceEvents(events, "America/Los_Angeles", tEve + 86_400_000 + 1000);
    expect(pLA.xpByDay).toEqual({ "2026-07-08": 15, "2026-07-09": 20 });
    // total XP matches the sum regardless of bucketing
    const sum = Object.values(p.xpByDay).reduce((a, b) => a + b, 0);
    expect(sum).toBe(p.xpTotal);
  });

  it("tracks longestStreak that survives a streak reset", () => {
    const day = 86_400_000;
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "a", occurredAt: T0, perfect: false, xp: 1 },
      { id: "2", type: "lesson_completed", lessonId: "b", occurredAt: T0 + day, perfect: false, xp: 1 },
      { id: "3", type: "lesson_completed", lessonId: "c", occurredAt: T0 + 2 * day, perfect: false, xp: 1 },
      // gap of 2 days -> streak resets to 1
      { id: "4", type: "lesson_completed", lessonId: "d", occurredAt: T0 + 5 * day, perfect: false, xp: 1 },
    ];
    const p = reduceEvents(events, TZ, T0 + 5 * day + 1000);
    expect(p.streak.count).toBe(1);
    expect(p.longestStreak).toBe(3);
  });

  it("applies goal_set last-write-wins in occurredAt order", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "goal_set", occurredAt: T0 + 2000, goalXp: 50 },
      { id: "2", type: "goal_set", occurredAt: T0 + 1000, goalXp: 20 },
      { id: "3", type: "goal_set", occurredAt: T0 + 3000, goalXp: 100 },
    ];
    const p = reduceEvents(events, TZ, T0 + 4000);
    expect(p.dailyGoalXp).toBe(100);
    // goal_set does not touch xp / hearts / streak
    expect(p.xpTotal).toBe(0);
    expect(p.streak.count).toBe(0);
    expect(p.hearts.hearts).toBe(MAX_HEARTS);
  });

  it("defaults dailyGoalXp when no goal_set event is present", () => {
    const p = reduceEvents([], TZ, T0);
    expect(p.dailyGoalXp).toBe(DEFAULT_DAILY_GOAL_XP);
  });

  it("ignores junk goalXp values (zero / negative / NaN)", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "goal_set", occurredAt: T0, goalXp: 40 },
      { id: "2", type: "goal_set", occurredAt: T0 + 1000, goalXp: 0 },
      { id: "3", type: "goal_set", occurredAt: T0 + 2000, goalXp: -10 },
      { id: "4", type: "goal_set", occurredAt: T0 + 3000, goalXp: Number.NaN },
    ];
    expect(reduceEvents(events, TZ, T0 + 4000).dailyGoalXp).toBe(40);
  });

  it("overlays local events on a modern baseline, carrying new fields forward", () => {
    const baseline = reduceEvents(
      [
        { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: true, xp: 15 },
        { id: "g", type: "goal_set", occurredAt: T0 + 1, goalXp: 40 },
      ],
      TZ,
      T0 + 1000,
    );
    const local: ProgressEvent[] = [
      { id: "2", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 86_400_000, perfect: false, xp: 10 },
    ];
    const p = reduceEvents(local, TZ, T0 + 86_400_000 + 1000, baseline);
    expect(p.lessonsCompleted).toBe(2);
    expect(p.perfectLessons).toBe(1);
    expect(p.dailyGoalXp).toBe(40);
    expect(p.longestStreak).toBe(2);
    expect(p.xpByDay).toEqual({ "2026-07-08": 15, "2026-07-09": 10 });
  });

  it("overlays on an OLD baseline missing the new fields, using ?? fallbacks", () => {
    // Simulate a baseline from an older server: only the original four fields.
    const oldBaseline = {
      xpTotal: 30,
      completedLessonIds: ["l1", "l2"],
      // lastDay is the same local day as the new event, so the streak count
      // itself doesn't move — isolating the longestStreak fallback.
      streak: { count: 4, lastDay: "2026-07-08" },
      hearts: reduceEvents([], TZ, T0).hearts,
    } as unknown as UserProgress;

    const local: ProgressEvent[] = [
      { id: "n", type: "lesson_completed", lessonId: "l3", occurredAt: T0, perfect: true, xp: 12 },
    ];
    const p = reduceEvents(local, TZ, T0 + 1000, oldBaseline);
    // lessonsCompleted falls back to completedLessonIds.length (2) + 1 new
    expect(p.lessonsCompleted).toBe(3);
    // perfect / practice / xpByDay start fresh, then fold the new event
    expect(p.perfectLessons).toBe(1);
    expect(p.practiceCount).toBe(0);
    expect(p.xpByDay).toEqual({ "2026-07-08": 12 });
    // longestStreak falls back to the baseline's current streak count (4)
    expect(p.longestStreak).toBe(4);
    // dailyGoalXp falls back to the default
    expect(p.dailyGoalXp).toBe(DEFAULT_DAILY_GOAL_XP);
    // xpTotal accumulates on top of the baseline
    expect(p.xpTotal).toBe(42);
  });

  it("builds the weak-exercise queue from missed ids, oldest first", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a", "b"] },
      { id: "2", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 1000, perfect: false, xp: 10, missedExerciseIds: ["c"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.weakExerciseIds).toEqual(["a", "b", "c"]);
    expect(p.mistakesCleared).toBe(0);
  });

  it("clears mastered exercises from the weak queue and counts them", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a", "b"] },
      { id: "2", type: "lesson_completed", lessonId: "review", occurredAt: T0 + 1000, perfect: true, xp: 5, practice: true, masteredExerciseIds: ["a"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.weakExerciseIds).toEqual(["b"]);
    expect(p.mistakesCleared).toBe(1);
  });

  it("does not count mastering an exercise that was never weak", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: true, xp: 15, masteredExerciseIds: ["a", "b"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 1000);
    expect(p.weakExerciseIds).toEqual([]);
    expect(p.mistakesCleared).toBe(0);
  });

  it("treats an id listed as both missed and mastered as still weak", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a"], masteredExerciseIds: ["a"] },
    ];
    expect(reduceEvents(events, TZ, T0 + 1000).weakExerciseIds).toEqual(["a"]);
  });

  it("re-missing a cleared exercise puts it back in the queue", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a"] },
      { id: "2", type: "lesson_completed", lessonId: "review", occurredAt: T0 + 1000, perfect: true, xp: 5, practice: true, masteredExerciseIds: ["a"] },
      { id: "3", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 2000, perfect: false, xp: 5, practice: true, missedExerciseIds: ["a"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 3000);
    expect(p.weakExerciseIds).toEqual(["a"]);
    expect(p.mistakesCleared).toBe(1);
  });

  it("carries the weak queue through a baseline overlay", () => {
    const baseline = reduceEvents(
      [{ id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a"] }],
      TZ,
      T0 + 1000,
    );
    const local: ProgressEvent[] = [
      { id: "2", type: "lesson_completed", lessonId: "review", occurredAt: T0 + 2000, perfect: true, xp: 5, practice: true, masteredExerciseIds: ["a"], missedExerciseIds: ["b"] },
    ];
    const p = reduceEvents(local, TZ, T0 + 3000, baseline);
    expect(p.weakExerciseIds).toEqual(["b"]);
    expect(p.mistakesCleared).toBe(1);
  });

  it("perfect practice replays do not count toward perfectLessons", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: true, xp: 15 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: true, xp: 5, practice: true },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.perfectLessons).toBe(1);
    expect(p.practiceCount).toBe(1);
  });

  it("survives a corrupt baseline missing completedLessonIds and streak entirely", () => {
    // A hand-edited or truncated localStorage baseline: object exists but the
    // nested fields the fallbacks read (.length / .count) are gone.
    const corrupt = { xpTotal: 10 } as unknown as UserProgress;
    const local: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10 },
    ];
    const p = reduceEvents(local, TZ, T0 + 1000, corrupt);
    expect(p.xpTotal).toBe(20);
    expect(p.completedLessonIds).toEqual(["l1"]);
    expect(p.lessonsCompleted).toBe(1);
    expect(p.streak.count).toBe(1);
    expect(p.longestStreak).toBe(1);
  });
});

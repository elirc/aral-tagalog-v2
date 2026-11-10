import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_GOAL_XP, reduceEvents, type ProgressEvent, type UserProgress } from "./events";
import { HEART_REGEN_MS, MAX_HEARTS } from "./hearts";
import { dueReviewIds } from "./review";

const TZ = "Asia/Manila";
const T0 = Date.UTC(2026, 6, 8, 10, 0, 0); // midday July 8 in Manila
const DAY = 86_400_000;

let seq = 0;
/** a lesson_completed carrying review outcomes; ids are unique and ordered */
const done = (
  occurredAt: number,
  over: { missed?: string[]; mastered?: string[]; id?: string } = {},
): ProgressEvent => ({
  id: over.id ?? `ev-${String(++seq).padStart(4, "0")}`,
  type: "lesson_completed",
  lessonId: "review",
  occurredAt,
  perfect: false,
  xp: 5,
  practice: true,
  missedExerciseIds: over.missed,
  masteredExerciseIds: over.mastered,
});

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
    // a miss is box 0, due from the moment it happened
    expect(p.reviewItems).toEqual({
      a: { box: 0, dueAt: T0 },
      b: { box: 0, dueAt: T0 },
      c: { box: 0, dueAt: T0 + 1000 },
    });
  });

  it("clears mastered exercises from the weak queue and counts them", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a", "b"] },
      { id: "2", type: "lesson_completed", lessonId: "review", occurredAt: T0 + 1000, perfect: true, xp: 5, practice: true, masteredExerciseIds: ["a"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.weakExerciseIds).toEqual(["b"]);
    expect(p.mistakesCleared).toBe(1);
    // cleared is no longer "gone forever": it is scheduled to come back
    expect(p.reviewItems.a).toEqual({ box: 1, dueAt: T0 + 1000 + DAY });
    const later = reduceEvents(events, TZ, T0 + 1000 + DAY);
    expect(later.weakExerciseIds).toEqual(["b", "a"]);
    expect(later.mistakesCleared).toBe(1);
  });

  it("does not count mastering an exercise that was never weak", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: true, xp: 15, masteredExerciseIds: ["a", "b"] },
    ];
    const p = reduceEvents(events, TZ, T0 + 1000);
    expect(p.weakExerciseIds).toEqual([]);
    expect(p.mistakesCleared).toBe(0);
    expect(p.reviewItems).toEqual({});
  });

  it("treats an id listed as both missed and mastered as still weak", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10, missedExerciseIds: ["a"], masteredExerciseIds: ["a"] },
    ];
    expect(reduceEvents(events, TZ, T0 + 1000).weakExerciseIds).toEqual(["a"]);
    // ...including when it was already weak: the contradictory event must
    // not sneak a clear (and a mistakesCleared point) past the miss
    const again: ProgressEvent[] = [...events, { ...events[0]!, id: "2", occurredAt: T0 + 500 } as ProgressEvent];
    const p = reduceEvents(again, TZ, T0 + 1000);
    expect(p.reviewItems.a).toEqual({ box: 0, dueAt: T0 });
    expect(p.mistakesCleared).toBe(0);
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
    // back to box 0, due from the new miss — the earned interval is forfeit
    expect(p.reviewItems.a).toEqual({ box: 0, dueAt: T0 + 2000 });
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
    expect(p.reviewItems).toEqual({
      a: { box: 1, dueAt: T0 + 2000 + DAY },
      b: { box: 0, dueAt: T0 + 2000 },
    });
  });

  it("clamps a replay to practice xp even when the event doesn't admit it", () => {
    // the cheat this guards: re-send completions of one easy lesson with
    // practice:false and full xp. Each event passes the per-event clamp; only
    // "already completed -> replay" stops the repetition.
    const events: ProgressEvent[] = [
      { id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 15 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: true, xp: 15 },
      { id: "3", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 2000, perfect: true, xp: 15 },
    ];
    const p = reduceEvents(events, TZ, T0 + 3000);
    expect(p.xpTotal).toBe(15 + 5 + 5);
    expect(p.completedLessonIds).toEqual(["l1"]);
    // the unflagged replays are still replays: no perfect credit, and they
    // count as practice (which is also what refills a heart)
    expect(p.perfectLessons).toBe(0);
    expect(p.practiceCount).toBe(2);
  });

  it("counts a replay of a lesson completed in the server baseline", () => {
    const baseline = reduceEvents(
      [{ id: "1", type: "lesson_completed", lessonId: "l1", occurredAt: T0, perfect: false, xp: 10 }],
      TZ,
      T0 + 1000,
    );
    const local: ProgressEvent[] = [
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 2000, perfect: false, xp: 10 },
    ];
    // the overlay must see the baseline's completions, not just this batch
    expect(reduceEvents(local, TZ, T0 + 3000, baseline).xpTotal).toBe(15);
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

describe("reduceEvents — mistakes recorded when they happen (hearts_lost.exerciseId)", () => {
  it("schedules the missed exercise without any lesson_completed", () => {
    // the hole this closes: run out of hearts mid-lesson and the session
    // never completes, so its mistakes were never reported at all
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 1, exerciseId: "a" },
      { id: "2", type: "hearts_lost", occurredAt: T0 + 1000, count: 1, exerciseId: "b" },
      { id: "3", type: "hearts_lost", occurredAt: T0 + 2000, count: 3, exerciseId: "a" },
    ];
    const p = reduceEvents(events, TZ, T0 + 3000);
    expect(p.hearts.hearts).toBe(0);
    expect(p.lessonsCompleted).toBe(0);
    expect(p.weakExerciseIds).toEqual(["a", "b"]);
    expect(p.reviewItems).toEqual({ a: { box: 0, dueAt: T0 }, b: { box: 0, dueAt: T0 + 1000 } });
  });

  it("is a no-op for review on an old event without the field", () => {
    const old: ProgressEvent[] = [{ id: "1", type: "hearts_lost", occurredAt: T0, count: 2 }];
    const p = reduceEvents(old, TZ, T0 + 1000);
    expect(p.hearts.hearts).toBe(MAX_HEARTS - 2);
    expect(p.weakExerciseIds).toEqual([]);
    expect(p.reviewItems).toEqual({});
  });

  it("ignores a junk exerciseId but still deducts the hearts", () => {
    const junk = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 1, exerciseId: "" },
      { id: "2", type: "hearts_lost", occurredAt: T0, count: 1, exerciseId: 42 },
      { id: "3", type: "hearts_lost", occurredAt: T0, count: 1, exerciseId: null },
    ] as unknown as ProgressEvent[];
    const p = reduceEvents(junk, TZ, T0 + 1000);
    expect(p.hearts.hearts).toBe(MAX_HEARTS - 3);
    expect(p.reviewItems).toEqual({});
  });

  it("records a miss that cost no hearts (count 0, practice runs)", () => {
    const p = reduceEvents(
      [{ id: "1", type: "hearts_lost", occurredAt: T0, count: 0, exerciseId: "a" }],
      TZ,
      T0 + 1000,
    );
    expect(p.hearts.hearts).toBe(MAX_HEARTS);
    expect(p.weakExerciseIds).toEqual(["a"]);
  });

  it("agrees with the completion report when the session does finish", () => {
    // both paths name the same miss; it must be one item, due from the miss
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 1, exerciseId: "a" },
      done(T0 + 60_000, { missed: ["a"], mastered: ["b"] }),
    ];
    const p = reduceEvents(events, TZ, T0 + 61_000);
    expect(p.reviewItems).toEqual({ a: { box: 0, dueAt: T0 } });
    expect(p.mistakesCleared).toBe(0);
  });

  it("sends an exercise that had earned an interval back to box 0", () => {
    const events: ProgressEvent[] = [
      done(T0, { missed: ["a"] }),
      done(T0 + 1000, { mastered: ["a"] }),
      { id: "h", type: "hearts_lost", occurredAt: T0 + 2000, count: 1, exerciseId: "a" },
    ];
    expect(reduceEvents(events, TZ, T0 + 3000).reviewItems.a).toEqual({ box: 0, dueAt: T0 + 2000 });
  });
});

describe("reduceEvents — spaced review (Leitner)", () => {
  it("climbs 1, 3, 7, 21 days and then graduates", () => {
    // the bug this replaces: one correct answer cleared an exercise forever
    const events: ProgressEvent[] = [done(T0, { missed: ["a"] })];
    let t = T0 + 1000;
    const expected = [1, 3, 7, 21];
    for (let box = 1; box <= 4; box++) {
      events.push(done(t, { mastered: ["a"] }));
      const p = reduceEvents(events, TZ, t);
      expect(p.reviewItems.a).toEqual({ box, dueAt: t + expected[box - 1]! * DAY });
      // not due a millisecond early, due exactly on time
      expect(reduceEvents(events, TZ, t + expected[box - 1]! * DAY - 1).weakExerciseIds).toEqual([]);
      expect(reduceEvents(events, TZ, t + expected[box - 1]! * DAY).weakExerciseIds).toEqual(["a"]);
      t += expected[box - 1]! * DAY;
    }
    events.push(done(t, { mastered: ["a"] }));
    const p = reduceEvents(events, TZ, t + 100 * DAY);
    expect(p.reviewItems).toEqual({});
    expect(p.weakExerciseIds).toEqual([]);
    // five masteries of one mistake are one mistake cleared
    expect(p.mistakesCleared).toBe(1);
  });

  it("does not advance on a mastery that arrives before the item is due", () => {
    // replaying the source lesson five times in a minute must not graduate it
    const events: ProgressEvent[] = [done(T0, { missed: ["a"] }), done(T0 + 1000, { mastered: ["a"] })];
    for (let i = 2; i < 7; i++) events.push(done(T0 + i * 1000, { mastered: ["a"] }));
    const p = reduceEvents(events, TZ, T0 + 10_000);
    expect(p.reviewItems.a).toEqual({ box: 1, dueAt: T0 + 1000 + DAY });
    expect(p.mistakesCleared).toBe(1);
  });

  it("counts a clear again after the exercise is missed again", () => {
    const events: ProgressEvent[] = [
      done(T0, { missed: ["a"] }),
      done(T0 + 1000, { mastered: ["a"] }),
      done(T0 + 2000, { missed: ["a"] }),
      done(T0 + 3000, { mastered: ["a"] }),
    ];
    expect(reduceEvents(events, TZ, T0 + 4000).mistakesCleared).toBe(2);
  });

  it("orders the due queue by due time, and by id on a tie", () => {
    const events: ProgressEvent[] = [
      done(T0, { missed: ["z", "m"] }), // same instant: id order
      done(T0 + 1000, { missed: ["a"] }),
      done(T0 + 2000, { mastered: ["z"] }), // z leaves for a day
    ];
    expect(reduceEvents(events, TZ, T0 + 3000).weakExerciseIds).toEqual(["m", "a"]);
    // when z returns it is the most recently due, so it goes last
    expect(reduceEvents(events, TZ, T0 + 2 * DAY).weakExerciseIds).toEqual(["m", "a", "z"]);
  });

  it("keeps the original due time when a still-weak exercise is missed again", () => {
    const events: ProgressEvent[] = [
      done(T0, { missed: ["a"] }),
      done(T0 + 1000, { missed: ["b"] }),
      done(T0 + 2000, { missed: ["a"] }),
    ];
    // the longest-standing mistake stays at the front
    expect(reduceEvents(events, TZ, T0 + 3000).weakExerciseIds).toEqual(["a", "b"]);
  });

  it("weakExerciseIds is exactly dueReviewIds(progress, now)", () => {
    const events: ProgressEvent[] = [
      done(T0, { missed: ["a", "b", "c"] }),
      done(T0 + 1000, { mastered: ["b"] }),
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.weakExerciseIds).toEqual(dueReviewIds(p, T0 + 2000));
    // a client holding `p` can ask again later without re-folding
    expect(dueReviewIds(p, T0 + 2 * DAY)).toEqual(reduceEvents(events, TZ, T0 + 2 * DAY).weakExerciseIds);
  });
});

describe("reduceEvents — review fold determinism and compatibility", () => {
  const stream = (): ProgressEvent[] => [
    done(T0, { id: "e01", missed: ["a", "b"] }),
    { id: "e02", type: "hearts_lost", occurredAt: T0 + 500, count: 1, exerciseId: "c" },
    done(T0 + 1000, { id: "e03", mastered: ["a"] }),
    { id: "e04", type: "hearts_lost", occurredAt: T0 + 1000, count: 1, exerciseId: "d" },
    done(T0 + DAY + 2000, { id: "e05", mastered: ["a", "b"], missed: ["c"] }),
    done(T0 + DAY + 2000, { id: "e06", missed: ["a"] }), // same instant as e05
    done(T0 + 2 * DAY, { id: "e07", mastered: ["d"] }),
  ];
  const NOW = T0 + 5 * DAY;

  it("gives the same schedule for any arrival order of the same events", () => {
    const expected = reduceEvents(stream(), TZ, NOW);
    const reversed = reduceEvents(stream().reverse(), TZ, NOW);
    const rotated = reduceEvents([...stream().slice(3), ...stream().slice(0, 3)], TZ, NOW);
    for (const p of [reversed, rotated]) {
      expect(p.reviewItems).toEqual(expected.reviewItems);
      expect(p.weakExerciseIds).toEqual(expected.weakExerciseIds);
      expect(p.mistakesCleared).toBe(expected.mistakesCleared);
      // byte-identical too: key order must not depend on arrival order
      expect(JSON.stringify(p.reviewItems)).toBe(JSON.stringify(expected.reviewItems));
    }
  });

  it("server full fold equals client baseline + outbox, wherever the stream is split", () => {
    // the invariant the whole sync design rests on. The baseline also makes a
    // JSON round trip, as it does over /sync and through client storage.
    const all = stream();
    const server = reduceEvents(all, TZ, NOW);
    for (let cut = 0; cut <= all.length; cut++) {
      const baselineNow = all[cut - 1]?.occurredAt ?? T0;
      const baseline = JSON.parse(
        JSON.stringify(reduceEvents(all.slice(0, cut), TZ, baselineNow)),
      ) as UserProgress;
      const client = reduceEvents(all.slice(cut), TZ, NOW, baseline);
      expect(client.reviewItems).toEqual(server.reviewItems);
      expect(client.weakExerciseIds).toEqual(server.weakExerciseIds);
      expect(client.mistakesCleared).toBe(server.mistakesCleared);
    }
  });

  it("the stored schedule does not depend on when the fold ran", () => {
    // only the due slice moves with `now`; a baseline folded yesterday is
    // still a valid baseline today
    const early = reduceEvents(stream(), TZ, T0 + 2 * DAY);
    const late = reduceEvents(stream(), TZ, T0 + 400 * DAY);
    expect(early.reviewItems).toEqual(late.reviewItems);
    expect(late.weakExerciseIds.sort()).toEqual(Object.keys(late.reviewItems).sort());
  });

  it("re-delivering an event does not advance a box twice", () => {
    const events = [done(T0, { id: "m", missed: ["a"] }), done(T0 + 1000, { id: "c", mastered: ["a"] })];
    const p = reduceEvents([...events, { ...events[1]! }], TZ, T0 + 2000);
    expect(p.reviewItems.a?.box).toBe(1);
    expect(p.mistakesCleared).toBe(1);
  });

  it("folds a pre-Leitner stream: old events need no migration", () => {
    // exactly the shapes already sitting in progress_events
    const old: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 1 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: false, xp: 10, missedExerciseIds: ["a", "b"] },
      { id: "3", type: "lesson_completed", lessonId: "review", occurredAt: T0 + 2000, perfect: true, xp: 5, practice: true, masteredExerciseIds: ["a"] },
    ];
    const p = reduceEvents(old, TZ, T0 + 3000);
    expect(p.weakExerciseIds).toEqual(["b"]);
    expect(p.mistakesCleared).toBe(1);
    // what changes for existing learners: "a" returns in a day instead of never
    expect(reduceEvents(old, TZ, T0 + 2000 + DAY).weakExerciseIds).toEqual(["b", "a"]);
  });

  it("seeds box 0 from a legacy baseline that only has weakExerciseIds", () => {
    const legacy = {
      xpTotal: 30,
      completedLessonIds: ["l1"],
      streak: { count: 1, lastDay: "2026-07-08" },
      hearts: reduceEvents([], TZ, T0).hearts,
      weakExerciseIds: ["zeta", "alpha", "mid"],
      mistakesCleared: 4,
    } as unknown as UserProgress;

    const untouched = reduceEvents([], TZ, T0, legacy);
    // legacy queue order survives (it was oldest-first), all due now
    expect(untouched.weakExerciseIds).toEqual(["zeta", "alpha", "mid"]);
    expect(Object.values(untouched.reviewItems).every((it) => it.box === 0)).toBe(true);
    expect(untouched.mistakesCleared).toBe(4);

    const p = reduceEvents([done(T0 + 1000, { mastered: ["alpha"], missed: ["new"] })], TZ, T0 + 2000, legacy);
    expect(p.weakExerciseIds).toEqual(["zeta", "mid", "new"]);
    expect(p.reviewItems.alpha).toEqual({ box: 1, dueAt: T0 + 1000 + DAY });
    expect(p.mistakesCleared).toBe(5);
  });

  it("prefers reviewItems over weakExerciseIds when a baseline has both", () => {
    // weakExerciseIds is only the due slice; seeding from it would drop every
    // exercise that is waiting out an interval
    const baseline = reduceEvents(
      [done(T0, { missed: ["a", "b"] }), done(T0 + 1000, { mastered: ["a"] })],
      TZ,
      T0 + 2000,
    );
    expect(baseline.weakExerciseIds).toEqual(["b"]);
    const p = reduceEvents([], TZ, T0 + 2 * DAY, baseline);
    expect(p.weakExerciseIds).toEqual(["b", "a"]);
    expect(p.reviewItems.a?.box).toBe(1);
  });

  it("drops corrupt reviewItems entries and clamps an impossible box", () => {
    const corrupt = {
      xpTotal: 0,
      reviewItems: {
        ok: { box: 2, dueAt: T0 },
        nullish: null,
        nan: { box: Number.NaN, dueAt: T0 },
        noDue: { box: 1 },
        huge: { box: 99, dueAt: T0 },
        negative: { box: -3, dueAt: T0 },
      },
    } as unknown as UserProgress;
    const p = reduceEvents([], TZ, T0 + 1000, corrupt);
    expect(p.reviewItems).toEqual({
      ok: { box: 2, dueAt: T0 },
      huge: { box: 4, dueAt: T0 },
      negative: { box: 0, dueAt: T0 },
    });
    // a clamped top-box item still graduates on its next mastery
    const after = reduceEvents([done(T0 + 500, { mastered: ["huge"] })], TZ, T0 + 1000, corrupt);
    expect(after.reviewItems.huge).toBeUndefined();
  });
});

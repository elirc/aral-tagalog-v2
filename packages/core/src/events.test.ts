import { describe, expect, it } from "vitest";
import { DAY_STATS_KEPT, DEFAULT_DAILY_GOAL_XP, reduceEvents, type ProgressEvent, type UserProgress } from "./events";
import { dailyQuests, type QuestDef } from "./quests";
import { localDayKey } from "./streak";
import { HEART_REGEN_MS, MAX_HEARTS } from "./hearts";

const TZ = "Asia/Manila";

/** Lesson XP per day, i.e. xpByDay with daily-quest rewards excluded. */
const lessonXpByDay = (p: UserProgress): Record<string, number> =>
  Object.fromEntries(Object.entries(p.dayStats).map(([day, s]) => [day, s.lessonXp]));

/** Everything the day's quests paid out across the whole fold. */
const questXpTotal = (p: UserProgress): number =>
  Object.values(p.dayStats).reduce((sum, s) => sum + s.questXp, 0);
const T0 = Date.UTC(2026, 6, 8, 10, 0, 0); // midday July 8 in Manila

describe("reduceEvents", () => {
  it("derives xp, completions, streak, and hearts from a stream", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "hearts_lost", occurredAt: T0, count: 2 },
      { id: "2", type: "lesson_completed", lessonId: "l1", occurredAt: T0 + 1000, perfect: false, xp: 10 },
      { id: "3", type: "lesson_completed", lessonId: "l2", occurredAt: T0 + 86_400_000, perfect: true, xp: 15 },
    ];
    const p = reduceEvents(events, TZ, T0 + 86_400_000 + 1000);
    expect(p.xpTotal).toBe(25 + questXpTotal(p));
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
    expect(p.xpTotal).toBe(25 + questXpTotal(p));
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
    expect(p.xpTotal).toBe(10 + questXpTotal(p));
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
    expect(lessonXpByDay(p)).toEqual({ "2026-07-09": 15, "2026-07-10": 20 });

    // Same events in Los Angeles bucket into the prior calendar day.
    const pLA = reduceEvents(events, "America/Los_Angeles", tEve + 86_400_000 + 1000);
    expect(lessonXpByDay(pLA)).toEqual({ "2026-07-08": 15, "2026-07-09": 20 });
    // xpByDay is lesson XP plus whatever that day's quests paid out — which
    // day a completion lands on decides which quests it can finish, so the
    // two zones do not necessarily award the same bonuses
    for (const [day, xp] of Object.entries(p.xpByDay))
      expect(xp).toBe(p.dayStats[day]!.lessonXp + p.dayStats[day]!.questXp);
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
    expect(lessonXpByDay(p)).toEqual({ "2026-07-08": 15, "2026-07-09": 10 });
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
    expect(lessonXpByDay(p)).toEqual({ "2026-07-08": 12 });
    // longestStreak falls back to the baseline's current streak count (4)
    expect(p.longestStreak).toBe(4);
    // dailyGoalXp falls back to the default
    expect(p.dailyGoalXp).toBe(DEFAULT_DAILY_GOAL_XP);
    // xpTotal accumulates on top of the baseline
    expect(p.xpTotal).toBe(42 + questXpTotal(p));
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
    // three completions of one lesson: full price once, practice rate after
    expect(p.xpTotal).toBe(15 + 5 + 5 + questXpTotal(p));
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
    const overlaid = reduceEvents(local, TZ, T0 + 3000, baseline);
    expect(overlaid.xpTotal).toBe(15 + questXpTotal(overlaid));
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
    expect(p.xpTotal).toBe(20 + questXpTotal(p));
    expect(p.completedLessonIds).toEqual(["l1"]);
    expect(p.lessonsCompleted).toBe(1);
    expect(p.streak.count).toBe(1);
    expect(p.longestStreak).toBe(1);
  });
});

describe("reduceEvents — day stats and daily quests", () => {
  const dayKey = localDayKey(T0, TZ);

  const completion = (
    id: string,
    over: Partial<Extract<ProgressEvent, { type: "lesson_completed" }>> = {},
  ): ProgressEvent => ({
    id,
    type: "lesson_completed",
    lessonId: `l-${id}`,
    occurredAt: T0,
    perfect: false,
    xp: 10,
    ...over,
  });

  it("keeps per-day counters for the metrics quests score", () => {
    const p = reduceEvents(
      [
        completion("1", { xp: 10, missedExerciseIds: ["x"] }),
        completion("2", { xp: 12, perfect: true, maxCombo: 6, masteredExerciseIds: ["x"] }),
        completion("3", { lessonId: "l-1", xp: 5, practice: true }),
      ],
      TZ,
      T0 + 1000,
    );
    const stats = p.dayStats[dayKey]!;
    expect(stats.lessons).toBe(3);
    expect(stats.perfect).toBe(1);
    expect(stats.practice).toBe(1);
    expect(stats.mistakesCleared).toBe(1);
    expect(stats.maxCombo).toBe(6);
    expect(stats.lessonXp).toBe(10 + 12 + 5);
  });

  it("keeps the highest combo of the day, not the last one", () => {
    const p = reduceEvents(
      [completion("1", { maxCombo: 9 }), completion("2", { maxCombo: 3 })],
      TZ,
      T0 + 1000,
    );
    expect(p.dayStats[dayKey]!.maxCombo).toBe(9);
  });

  it("clamps an absurd claimed combo", () => {
    const p = reduceEvents([completion("1", { maxCombo: 1e9 })], TZ, T0 + 1000);
    expect(p.dayStats[dayKey]!.maxCombo).toBeLessThanOrEqual(500);
  });

  it("credits a finished quest's XP and never credits it twice", () => {
    // find a day whose quest set includes a lessons quest, so the scenario is
    // driven by the pool rather than hard-coded to one day's draw
    const day = 86_400_000;
    let offset = 0;
    let quest: QuestDef | undefined;
    for (; offset < 40; offset++) {
      quest = dailyQuests(localDayKey(T0 + offset * day, TZ)).find((q) => q.metric === "lessons");
      if (quest) break;
    }
    expect(quest).toBeDefined();
    const at = T0 + offset * day;
    const key = localDayKey(at, TZ);
    const events = Array.from({ length: quest!.target }, (_, i) =>
      completion(`q${i}`, { lessonId: `ql${i}`, occurredAt: at + i, xp: 10 }),
    );

    const p = reduceEvents(events, TZ, at + 10_000);
    expect(p.dayStats[key]!.questIds).toContain(quest!.id);
    expect(p.dayStats[key]!.questXp).toBeGreaterThanOrEqual(quest!.rewardXp);
    expect(p.xpTotal).toBe(10 * quest!.target + p.dayStats[key]!.questXp);

    // re-folding the same stream must land on exactly the same totals
    expect(reduceEvents(events, TZ, at + 10_000).xpTotal).toBe(p.xpTotal);

    // ...and an extra completion on top must not re-pay it. Other quests on
    // the same day may finish off the back of that lesson, so assert on this
    // quest specifically rather than on the day's total reward.
    const more = reduceEvents([completion("extra", { occurredAt: at + 500 })], TZ, at + 10_000, p);
    expect(more.dayStats[key]!.questIds.filter((id) => id === quest!.id)).toHaveLength(1);
    const extraQuestXp = more.dayStats[key]!.questXp - p.dayStats[key]!.questXp;
    expect(more.xpTotal).toBe(p.xpTotal + 10 + extraQuestXp);
  });

  it("folds an outbox over a baseline to the same place as one full fold", () => {
    // the property the whole derived-reward design rests on: the server folds
    // everything from scratch, the client overlays its outbox, and they agree
    const day = 86_400_000;
    const all: ProgressEvent[] = [
      completion("1", { xp: 20, perfect: true, maxCombo: 12 }),
      completion("2", { xp: 20, perfect: true, maxCombo: 4, missedExerciseIds: ["a"] }),
      completion("3", { lessonId: "l-1", xp: 5, practice: true, masteredExerciseIds: ["a"] }),
      completion("4", { occurredAt: T0 + day, xp: 30, perfect: true, maxCombo: 15 }),
      completion("5", { occurredAt: T0 + day, xp: 30 }),
    ];
    const now = T0 + day + 10_000;
    const server = reduceEvents(all, TZ, now);
    const baseline = reduceEvents(all.slice(0, 3), TZ, now);
    const client = reduceEvents(all.slice(3), TZ, now, baseline);
    expect(client.xpTotal).toBe(server.xpTotal);
    expect(client.dayStats).toEqual(server.dayStats);
    expect(client.completedLessonIds.sort()).toEqual(server.completedLessonIds.sort());
  });

  it("quest rewards never feed the XP quest that paid them", () => {
    const day = 86_400_000;
    for (let offset = 0; offset < 40; offset++) {
      const at = T0 + offset * day;
      const key = localDayKey(at, TZ);
      const xpQuest = dailyQuests(key).find((q) => q.metric === "xp");
      if (!xpQuest) continue;
      // land exactly one lesson XP short of the target
      const p = reduceEvents(
        [completion("1", { occurredAt: at, xp: xpQuest.target - 1 })],
        TZ,
        at + 1000,
      );
      // other quests may have paid out, but this one must not have
      expect(p.dayStats[key]!.questIds).not.toContain(xpQuest.id);
      return;
    }
    throw new Error("no xp quest found in 40 days — pool changed?");
  });

  it("keeps only the most recent DAY_STATS_KEPT days", () => {
    const day = 86_400_000;
    const events = Array.from({ length: DAY_STATS_KEPT + 10 }, (_, i) =>
      completion(`d${i}`, { lessonId: `dl${i}`, occurredAt: T0 + i * day, xp: 1 }),
    );
    const p = reduceEvents(events, TZ, T0 + (DAY_STATS_KEPT + 10) * day);
    expect(Object.keys(p.dayStats)).toHaveLength(DAY_STATS_KEPT);
    // the oldest day is dropped from dayStats but survives in xpByDay
    const oldest = localDayKey(T0, TZ);
    expect(p.dayStats[oldest]).toBeUndefined();
    expect(p.xpByDay[oldest]).toBe(1);
  });
});

describe("reduceEvents — tier placement", () => {
  it("records tiers the learner placed into, additively and idempotently", () => {
    const events: ProgressEvent[] = [
      { id: "1", type: "tier_started", occurredAt: T0, tierId: "conversational" },
      { id: "1", type: "tier_started", occurredAt: T0, tierId: "conversational" }, // retry
      { id: "2", type: "tier_started", occurredAt: T0 + 1000, tierId: "mastery" },
    ];
    const p = reduceEvents(events, TZ, T0 + 2000);
    expect(p.unlockedTierIds.sort()).toEqual(["conversational", "mastery"]);
  });

  it("grants no xp, streak, hearts, or completions", () => {
    const p = reduceEvents(
      [{ id: "1", type: "tier_started", occurredAt: T0, tierId: "mastery" }],
      TZ,
      T0 + 1000,
    );
    expect(p.xpTotal).toBe(0);
    expect(p.streak.count).toBe(0);
    expect(p.hearts.hearts).toBe(MAX_HEARTS);
    expect(p.completedLessonIds).toEqual([]);
    expect(p.lessonsCompleted).toBe(0);
  });

  it("ignores an empty tier id", () => {
    const p = reduceEvents(
      [{ id: "1", type: "tier_started", occurredAt: T0, tierId: "" }],
      TZ,
      T0 + 1000,
    );
    expect(p.unlockedTierIds).toEqual([]);
  });

  it("carries placements forward from a baseline", () => {
    const baseline = reduceEvents(
      [{ id: "1", type: "tier_started", occurredAt: T0, tierId: "everyday" }],
      TZ,
      T0 + 1000,
    );
    const p = reduceEvents(
      [{ id: "2", type: "tier_started", occurredAt: T0 + 2000, tierId: "mastery" }],
      TZ,
      T0 + 3000,
      baseline,
    );
    expect(p.unlockedTierIds.sort()).toEqual(["everyday", "mastery"]);
  });

  it("defaults to no placements on an old baseline that lacks the field", () => {
    const old = { xpTotal: 5, completedLessonIds: ["l1"] } as unknown as UserProgress;
    expect(reduceEvents([], TZ, T0, old).unlockedTierIds).toEqual([]);
  });
});

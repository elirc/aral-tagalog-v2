import { describe, expect, it } from "vitest";
import {
  DAILY_QUEST_COUNT,
  dailyQuestMaxXp,
  dailyQuests,
  emptyDayStats,
  pendingQuestRewards,
  questStatuses,
  questValue,
  QUEST_POOL,
  type DayStats,
  type QuestMetric,
} from "./quests";

const day = (over: Partial<DayStats> = {}): DayStats => ({ ...emptyDayStats, ...over });

/** A day whose counter for `metric` sits at `value` (mirrors questValue). */
function withMetric(metric: QuestMetric, value: number, over: Partial<DayStats> = {}): DayStats {
  const base = day(over);
  switch (metric) {
    case "xp":
      return { ...base, lessonXp: value };
    case "lessons":
      return { ...base, lessons: value };
    case "perfect":
      return { ...base, perfect: value };
    case "practice":
      return { ...base, practice: value };
    case "review":
      return { ...base, mistakesCleared: value };
    case "combo":
      return { ...base, maxCombo: value };
  }
}

describe("dailyQuests", () => {
  it("is deterministic in the day key — every client and the server agree", () => {
    expect(dailyQuests("2026-08-20").map((q) => q.id)).toEqual(
      dailyQuests("2026-08-20").map((q) => q.id),
    );
  });

  it("gives different days different sets", () => {
    const keys = ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24"];
    const sets = keys.map((k) => dailyQuests(k).map((q) => q.id).join(","));
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it("never repeats a metric within a day", () => {
    for (let d = 1; d <= 28; d++) {
      const key = `2026-02-${String(d).padStart(2, "0")}`;
      const metrics = dailyQuests(key).map((q) => q.metric);
      expect(new Set(metrics).size).toBe(metrics.length);
    }
  });

  it("always returns the full count, ordered easiest first", () => {
    const quests = dailyQuests("2026-08-20");
    expect(quests).toHaveLength(DAILY_QUEST_COUNT);
    const rewards = quests.map((q) => q.rewardXp);
    expect([...rewards].sort((a, b) => a - b)).toEqual(rewards);
    expect(dailyQuestMaxXp("2026-08-20")).toBe(rewards.reduce((a, b) => a + b, 0));
  });

  it("draws only from the pool", () => {
    const ids = new Set(QUEST_POOL.map((q) => q.id));
    for (const q of dailyQuests("2026-12-25")) expect(ids.has(q.id)).toBe(true);
  });

  it("has a pool with unique ids and positive targets and rewards", () => {
    expect(new Set(QUEST_POOL.map((q) => q.id)).size).toBe(QUEST_POOL.length);
    for (const q of QUEST_POOL) {
      expect(q.target).toBeGreaterThan(0);
      expect(q.rewardXp).toBeGreaterThan(0);
    }
  });
});

describe("questValue", () => {
  it("measures lesson XP, never quest reward XP", () => {
    // the reward must not be able to complete the quest that paid it
    expect(questValue("xp", day({ lessonXp: 30, questXp: 100 }))).toBe(30);
  });

  it("maps each metric to its counter", () => {
    const d = day({ lessons: 2, perfect: 1, practice: 3, mistakesCleared: 4, maxCombo: 7 });
    expect(questValue("lessons", d)).toBe(2);
    expect(questValue("perfect", d)).toBe(1);
    expect(questValue("practice", d)).toBe(3);
    expect(questValue("review", d)).toBe(4);
    expect(questValue("combo", d)).toBe(7);
  });
});

describe("pendingQuestRewards", () => {
  const dayKey = "2026-08-20";
  const quests = dailyQuests(dayKey);

  it("pays nothing for an untouched day", () => {
    expect(pendingQuestRewards(dayKey, emptyDayStats)).toEqual({ ids: [], xp: 0 });
  });

  it("pays a quest exactly once", () => {
    const first = quests[0]!;
    const stats = withMetric(first.metric, first.target);
    const owed = pendingQuestRewards(dayKey, stats);
    // metrics are unique per day, so only this quest can have completed
    expect(owed.ids).toEqual([first.id]);
    expect(owed.xp).toBe(first.rewardXp);
    // once credited, it is never owed again
    expect(pendingQuestRewards(dayKey, { ...stats, questIds: owed.ids })).toEqual({ ids: [], xp: 0 });
  });

  it("pays nothing below target", () => {
    const q = quests.find((x) => x.target > 1)!;
    expect(pendingQuestRewards(dayKey, withMetric(q.metric, q.target - 1)).ids).not.toContain(q.id);
  });

  it("pays every quest a day completes at once", () => {
    let stats = emptyDayStats;
    for (const q of quests) stats = withMetric(q.metric, q.target, stats);
    const owed = pendingQuestRewards(dayKey, stats);
    expect(owed.ids.sort()).toEqual(quests.map((q) => q.id).sort());
    expect(owed.xp).toBe(dailyQuestMaxXp(dayKey));
  });
});

describe("questStatuses", () => {
  const dayKey = "2026-08-20";

  it("reports progress, completion, and whether the XP already landed", () => {
    const q = dailyQuests(dayKey)[0]!;
    const stats = withMetric(q.metric, q.target, { questIds: [q.id] });
    const status = questStatuses(dayKey, stats).find((s) => s.def.id === q.id)!;
    expect(status.complete).toBe(true);
    expect(status.claimed).toBe(true);
    expect(status.fraction).toBe(1);
  });

  it("caps the fraction at 1 when a counter overshoots", () => {
    const q = dailyQuests(dayKey)[0]!;
    const status = questStatuses(dayKey, withMetric(q.metric, q.target * 10)).find(
      (s) => s.def.id === q.id,
    )!;
    expect(status.fraction).toBe(1);
    expect(status.claimed).toBe(false); // complete, but the reducer hasn't paid yet
  });

  it("defaults to an empty day when the user has done nothing", () => {
    expect(questStatuses(dayKey).every((s) => !s.complete && s.value === 0)).toBe(true);
  });
});

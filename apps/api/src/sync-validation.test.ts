import { describe, expect, it } from "vitest";
import { lessonXp, MAX_COMBO_BONUS_XP, PRACTICE_XP } from "@aral/core";
import { eventSchema, sanitizeEvents, type LessonCatalog } from "./sync-validation";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = 1_700_000_000_000;

const catalog: LessonCatalog = {
  lessonById: new Map([
    ["l1", { id: "l1", xp: 10, exerciseCount: 1 }],
    // The catalog stores counts rather than full exercise payloads.
    ["l2", { id: "l2", xp: 10, exerciseCount: 3 }],
  ]),
  maxAuthoredXp: 100,
};

const completed = (over: Record<string, unknown> = {}) => ({
  id: uuid(1),
  type: "lesson_completed",
  lessonId: "l1",
  occurredAt: NOW - 1000,
  perfect: false,
  xp: 10,
  ...over,
});

describe("sanitizeEvents: batch handling", () => {
  it("passes a valid batch of every event type with ids preserved", () => {
    const batch = [
      completed(),
      { id: uuid(2), type: "hearts_lost", occurredAt: NOW - 900, count: 3 },
      { id: uuid(3), type: "hearts_refilled", occurredAt: NOW - 800, amount: "full", source: "ad" },
      { id: uuid(4), type: "goal_set", occurredAt: NOW - 700, goalXp: 50 },
      { id: uuid(5), type: "tier_started", occurredAt: NOW - 600, tierId: "mastery" },
    ];
    const { events, rejected } = sanitizeEvents(batch, catalog, NOW);
    expect(rejected).toEqual([]);
    expect(events.map((e) => e.id)).toEqual([uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)]);
    expect(events.map((e) => e.type)).toEqual([
      "lesson_completed",
      "hearts_lost",
      "hearts_refilled",
      "goal_set",
      "tier_started",
    ]);
  });

  it("reports an invalid event carrying a string id in rejected, keeping valid siblings", () => {
    const bad = { id: uuid(9), type: "lesson_completed" }; // missing required fields
    const { events, rejected } = sanitizeEvents([bad, completed()], catalog, NOW);
    expect(rejected).toEqual([uuid(9)]);
    expect(events.map((e) => e.id)).toEqual([uuid(1)]);
  });

  it("drops invalid events without a string id silently", () => {
    // documented behavior: nothing to report the failure against
    const noId = { type: "hearts_lost", occurredAt: NOW, count: 3 };
    const numericId = { id: 42, type: "goal_set", occurredAt: NOW, goalXp: 50 };
    const { events, rejected } = sanitizeEvents([noId, numericId, completed()], catalog, NOW);
    expect(rejected).toEqual([]);
    expect(events.map((e) => e.id)).toEqual([uuid(1)]);
  });

  it("rejects a non-UUID id", () => {
    const { events, rejected } = sanitizeEvents([completed({ id: "not-a-uuid" })], catalog, NOW);
    expect(events).toEqual([]);
    expect(rejected).toEqual(["not-a-uuid"]);
  });
});

describe("sanitizeEvents: xp clamping", () => {
  const xpOf = (batch: unknown[], cat: LessonCatalog | null) => {
    const { events, rejected } = sanitizeEvents(batch, cat, NOW);
    expect(rejected).toEqual([]);
    return (events[0] as { xp: number }).xp;
  };

  it("clamps a non-practice completion to its authored value plus the combo ceiling", () => {
    // a session can add up to MAX_COMBO_BONUS_XP on top of the authored xp,
    // so the cap has to leave room for it — but no more than that
    expect(xpOf([completed({ xp: 100 })], catalog)).toBe(lessonXp({ xp: 10 }, false) + MAX_COMBO_BONUS_XP);
  });

  it("allows the perfect bonus, so the perfect cap exceeds the ordinary one", () => {
    const perfectCap = xpOf([completed({ xp: 100, perfect: true })], catalog);
    expect(perfectCap).toBe(lessonXp({ xp: 10 }, true) + MAX_COMBO_BONUS_XP);
    expect(perfectCap).toBeGreaterThan(xpOf([completed({ xp: 100 })], catalog));
  });

  it("leaves an honest claim alone", () => {
    // the common case: a perfect run with a modest combo, well under the cap
    expect(xpOf([completed({ xp: 18, perfect: true })], catalog)).toBe(18);
  });

  it("clamps an unknown lessonId to the catalog-wide max instead of rejecting", () => {
    // bundle version skew: a newer client's lesson isn't in our catalog
    const skewed: LessonCatalog = { ...catalog, maxAuthoredXp: 60 };
    expect(xpOf([completed({ lessonId: "ghost", xp: 100 })], skewed)).toBe(60 + MAX_COMBO_BONUS_XP);
    // with the fixture max (100), a max-xp claim survives untouched
    expect(xpOf([completed({ lessonId: "ghost", xp: 100 })], catalog)).toBe(100);
  });

  it("clamps practice completions to PRACTICE_XP even when the catalog is null", () => {
    // no combo allowance on replays — that is the anti-farming rule
    expect(xpOf([completed({ practice: true, xp: 50 })], null)).toBe(PRACTICE_XP);
  });

  it("gives practice no combo allowance even for a known lesson", () => {
    expect(xpOf([completed({ practice: true, xp: 100 })], catalog)).toBe(PRACTICE_XP);
  });

  it("leaves xp unclamped when the catalog is null and practice is absent", () => {
    expect(xpOf([completed({ xp: 87 })], null)).toBe(87);
  });

  it("rejects xp above the schema maximum outright", () => {
    // 95 authored + 5 perfect + 10 combo = 120 is the most any event can claim
    expect(eventSchema.safeParse(completed({ xp: 120 })).success).toBe(true);
    const { events, rejected } = sanitizeEvents([completed({ xp: 121 })], null, NOW);
    expect(events).toEqual([]);
    expect(rejected).toEqual([uuid(1)]);
  });
});

describe("sanitizeEvents: maxCombo", () => {
  it("clamps a claimed combo to the lesson's exercise count", () => {
    // a session cannot answer more questions correctly than it contains, and
    // combo quests pay XP off this number
    const { events } = sanitizeEvents([completed({ lessonId: "l2", maxCombo: 99 })], catalog, NOW);
    expect((events[0] as { maxCombo?: number }).maxCombo).toBe(3);
  });

  it("leaves an honest combo alone", () => {
    const { events } = sanitizeEvents([completed({ lessonId: "l2", maxCombo: 2 })], catalog, NOW);
    expect((events[0] as { maxCombo?: number }).maxCombo).toBe(2);
  });

  it("keeps the schema bound for a lesson the catalog doesn't know", () => {
    const { events, rejected } = sanitizeEvents(
      [completed({ lessonId: "ghost", maxCombo: 400 })],
      catalog,
      NOW,
    );
    expect(rejected).toEqual([]);
    expect((events[0] as { maxCombo?: number }).maxCombo).toBe(400);
  });

  it("bounds maxCombo to 0..500 in the schema", () => {
    expect(eventSchema.safeParse(completed({ maxCombo: -1 })).success).toBe(false);
    expect(eventSchema.safeParse(completed({ maxCombo: 501 })).success).toBe(false);
    expect(eventSchema.safeParse(completed({ maxCombo: 1.5 })).success).toBe(false);
    expect(eventSchema.safeParse(completed({ maxCombo: 0 })).success).toBe(true);
  });

  it("is optional — older clients omit it", () => {
    const { events, rejected } = sanitizeEvents([completed()], catalog, NOW);
    expect(rejected).toEqual([]);
    expect((events[0] as { maxCombo?: number }).maxCombo).toBeUndefined();
  });
});

describe("sanitizeEvents: tier_started", () => {
  const tier = (over: Record<string, unknown> = {}) => ({
    id: uuid(7),
    type: "tier_started",
    occurredAt: NOW - 500,
    tierId: "mastery",
    ...over,
  });

  it("accepts a placement event and preserves the tier id", () => {
    const { events, rejected } = sanitizeEvents([tier()], catalog, NOW);
    expect(rejected).toEqual([]);
    expect(events[0]).toMatchObject({ type: "tier_started", tierId: "mastery" });
  });

  it("rejects an empty or oversized tier id", () => {
    expect(eventSchema.safeParse(tier({ tierId: "" })).success).toBe(false);
    expect(eventSchema.safeParse(tier({ tierId: "x".repeat(61) })).success).toBe(false);
    expect(eventSchema.safeParse(tier({ tierId: "x".repeat(60) })).success).toBe(true);
  });

  it("clamps a future placement timestamp like every other event", () => {
    const { events } = sanitizeEvents([tier({ occurredAt: NOW + 60_000 })], catalog, NOW);
    expect(events[0]!.occurredAt).toBe(NOW);
  });
});

describe("sanitizeEvents: timestamps", () => {
  it("clamps a future occurredAt to now", () => {
    const { events } = sanitizeEvents([completed({ occurredAt: NOW + 60_000 })], catalog, NOW);
    expect(events[0]!.occurredAt).toBe(NOW);
  });

  it("leaves past timestamps untouched", () => {
    const { events } = sanitizeEvents([completed({ occurredAt: NOW - 5000 })], catalog, NOW);
    expect(events[0]!.occurredAt).toBe(NOW - 5000);
  });

  it("rejects an occurredAt Postgres could not store, instead of poisoning the batch", () => {
    // occurred_at is a bigint column: a fractional or absurd value passes a
    // bare z.number() but fails on INSERT, and /sync inserts the batch in one
    // statement — so one bad event would 500 the request and wedge the client
    // outbox, which the per-event `rejected` list exists to prevent.
    for (const bad of [1.5, -1, Number.MAX_SAFE_INTEGER + 2, Number.POSITIVE_INFINITY, NaN]) {
      const { events, rejected } = sanitizeEvents(
        [completed({ occurredAt: bad }), completed({ id: uuid(9) })],
        catalog,
        NOW,
      );
      // the malformed one is rejected by id; the healthy sibling still lands
      expect(rejected).toEqual([uuid(1)]);
      expect(events).toHaveLength(1);
      expect(events[0]!.id).toBe(uuid(9));
    }
  });
});

describe("eventSchema: field bounds", () => {
  it("passes missed/mastered exercise-id arrays through sanitizeEvents", () => {
    const ev = completed({ missedExerciseIds: ["a", "b"], masteredExerciseIds: ["c"] });
    const { events } = sanitizeEvents([ev], catalog, NOW);
    expect(events[0]).toMatchObject({ missedExerciseIds: ["a", "b"], masteredExerciseIds: ["c"] });
  });

  it("rejects exercise-id arrays longer than 50", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i}`);
    expect(eventSchema.safeParse(completed({ missedExerciseIds: ids(51) })).success).toBe(false);
    expect(eventSchema.safeParse(completed({ masteredExerciseIds: ids(51) })).success).toBe(false);
    expect(eventSchema.safeParse(completed({ missedExerciseIds: ids(50) })).success).toBe(true);
  });

  it("bounds hearts_lost count to 1..20", () => {
    const lost = (count: number) => ({ id: uuid(5), type: "hearts_lost", occurredAt: NOW, count });
    expect(eventSchema.safeParse(lost(0)).success).toBe(false);
    expect(eventSchema.safeParse(lost(21)).success).toBe(false);
    expect(eventSchema.safeParse(lost(1)).success).toBe(true);
    expect(eventSchema.safeParse(lost(20)).success).toBe(true);
  });

  it("bounds goal_set goalXp to 10..200", () => {
    const goal = (goalXp: number) => ({ id: uuid(6), type: "goal_set", occurredAt: NOW, goalXp });
    expect(eventSchema.safeParse(goal(9)).success).toBe(false);
    expect(eventSchema.safeParse(goal(201)).success).toBe(false);
    expect(eventSchema.safeParse(goal(10)).success).toBe(true);
    expect(eventSchema.safeParse(goal(200)).success).toBe(true);
  });
});

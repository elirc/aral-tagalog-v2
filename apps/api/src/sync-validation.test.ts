import { describe, expect, it } from "vitest";
import { lessonXp, PRACTICE_XP } from "@aral/core";
import { eventSchema, sanitizeEvents, type LessonCatalog } from "./sync-validation";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = 1_700_000_000_000;

const catalog: LessonCatalog = {
  lessonById: new Map([["l1", { id: "l1", title: "T", xp: 10, exercises: [] }]]),
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
  it("passes a valid batch of all four event types with ids preserved", () => {
    const batch = [
      completed(),
      { id: uuid(2), type: "hearts_lost", occurredAt: NOW - 900, count: 3 },
      { id: uuid(3), type: "hearts_refilled", occurredAt: NOW - 800, amount: "full", source: "ad" },
      { id: uuid(4), type: "goal_set", occurredAt: NOW - 700, goalXp: 50 },
    ];
    const { events, rejected } = sanitizeEvents(batch, catalog, NOW);
    expect(rejected).toEqual([]);
    expect(events.map((e) => e.id)).toEqual([uuid(1), uuid(2), uuid(3), uuid(4)]);
    expect(events.map((e) => e.type)).toEqual([
      "lesson_completed",
      "hearts_lost",
      "hearts_refilled",
      "goal_set",
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

  it("clamps a non-practice completion of a known lesson to its authored value", () => {
    expect(xpOf([completed({ xp: 100 })], catalog)).toBe(lessonXp({ xp: 10 }, false));
  });

  it("allows the perfect bonus, so the perfect cap exceeds the ordinary one", () => {
    const perfectCap = xpOf([completed({ xp: 100, perfect: true })], catalog);
    expect(perfectCap).toBe(lessonXp({ xp: 10 }, true));
    expect(perfectCap).toBeGreaterThan(lessonXp({ xp: 10 }, false));
  });

  it("clamps an unknown lessonId to the catalog-wide max instead of rejecting", () => {
    // bundle version skew: a newer client's lesson isn't in our catalog
    const skewed: LessonCatalog = { ...catalog, maxAuthoredXp: 60 };
    expect(xpOf([completed({ lessonId: "ghost", xp: 100 })], skewed)).toBe(60);
    // with the fixture max (100), a max-xp claim survives untouched
    expect(xpOf([completed({ lessonId: "ghost", xp: 100 })], catalog)).toBe(100);
  });

  it("clamps practice completions to PRACTICE_XP even when the catalog is null", () => {
    expect(xpOf([completed({ practice: true, xp: 50 })], null)).toBe(PRACTICE_XP);
  });

  it("leaves xp unclamped when the catalog is null and practice is absent", () => {
    expect(xpOf([completed({ xp: 87 })], null)).toBe(87);
  });

  it("rejects xp above the schema maximum outright", () => {
    const { events, rejected } = sanitizeEvents([completed({ xp: 101 })], null, NOW);
    expect(events).toEqual([]);
    expect(rejected).toEqual([uuid(1)]);
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

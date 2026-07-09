import { describe, expect, it } from "vitest";
import { reduceEvents, type ProgressEvent } from "./events";
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
});

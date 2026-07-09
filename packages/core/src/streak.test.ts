import { describe, expect, it } from "vitest";
import { applyCompletionDay, displayStreak, emptyStreak, isStreakAlive, localDayKey } from "./streak";

describe("streak", () => {
  it("computes local day keys per timezone", () => {
    // 2026-07-09 03:00 UTC = July 8 in Los Angeles, July 9 in Manila
    const t = Date.UTC(2026, 6, 9, 3, 0, 0);
    expect(localDayKey(t, "America/Los_Angeles")).toBe("2026-07-08");
    expect(localDayKey(t, "Asia/Manila")).toBe("2026-07-09");
  });

  it("increments on consecutive days, once per day", () => {
    let s = applyCompletionDay(emptyStreak, "2026-07-08");
    expect(s.count).toBe(1);
    s = applyCompletionDay(s, "2026-07-08"); // second lesson same day
    expect(s.count).toBe(1);
    s = applyCompletionDay(s, "2026-07-09");
    expect(s.count).toBe(2);
  });

  it("resets after a missed day", () => {
    let s = applyCompletionDay(emptyStreak, "2026-07-01");
    s = applyCompletionDay(s, "2026-07-03");
    expect(s.count).toBe(1);
  });

  it("handles month boundaries", () => {
    let s = applyCompletionDay(emptyStreak, "2026-06-30");
    s = applyCompletionDay(s, "2026-07-01");
    expect(s.count).toBe(2);
  });

  it("shows 0 once the streak is dead but keeps alive through yesterday", () => {
    const s = applyCompletionDay(emptyStreak, "2026-07-08");
    expect(isStreakAlive(s, "2026-07-09")).toBe(true);
    expect(displayStreak(s, "2026-07-10")).toBe(0);
  });
});

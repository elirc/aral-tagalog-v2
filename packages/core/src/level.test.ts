import { describe, expect, it } from "vitest";
import { levelForXp, levelProgress, xpThresholdForLevel } from "./level";

describe("levelForXp", () => {
  it("starts everyone at level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(1)).toBe(1);
    expect(levelForXp(49)).toBe(1);
  });

  it("hits the documented thresholds", () => {
    // threshold(n) = 25 * n * (n - 1): 0, 50, 150, 300, 500 ...
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(149)).toBe(2);
    expect(levelForXp(150)).toBe(3);
    expect(levelForXp(299)).toBe(3);
    expect(levelForXp(300)).toBe(4);
    expect(levelForXp(500)).toBe(5);
  });

  it("is exact at each level boundary (on/just-below)", () => {
    for (let level = 2; level <= 60; level++) {
      const threshold = xpThresholdForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      expect(levelForXp(threshold - 1)).toBe(level - 1);
    }
  });

  it("is monotonic non-decreasing in xp", () => {
    let prev = 1;
    for (let xp = 0; xp <= 5000; xp += 7) {
      const lvl = levelForXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  it("never returns below level 1 for junk input", () => {
    expect(levelForXp(-100)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it("terminates on non-finite and absurdly large xp (corrupt baseline)", () => {
    // JSON.parse('{"xpTotal":1e400}') yields Infinity — must not hang the UI
    expect(levelForXp(Number.POSITIVE_INFINITY)).toBeGreaterThanOrEqual(1);
    expect(levelForXp(1e300)).toBeGreaterThanOrEqual(1);
    expect(levelProgress(Number.POSITIVE_INFINITY).level).toBeGreaterThanOrEqual(1);
  });
});

describe("xpThresholdForLevel", () => {
  it("matches the closed-form curve", () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(50);
    expect(xpThresholdForLevel(3)).toBe(150);
    expect(xpThresholdForLevel(4)).toBe(300);
    expect(xpThresholdForLevel(5)).toBe(500);
  });
});

describe("levelProgress", () => {
  it("reports 0 progress right at a level-up", () => {
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 50 });
    expect(levelProgress(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelProgress(150)).toEqual({ level: 3, xpIntoLevel: 0, xpForNextLevel: 150 });
  });

  it("splits xp into current-level progress", () => {
    expect(levelProgress(75)).toEqual({ level: 2, xpIntoLevel: 25, xpForNextLevel: 100 });
    // just before level 3
    expect(levelProgress(149)).toEqual({ level: 2, xpIntoLevel: 99, xpForNextLevel: 100 });
  });

  it("keeps xpIntoLevel within [0, xpForNextLevel)", () => {
    for (let xp = 0; xp <= 3000; xp += 13) {
      const p = levelProgress(xp);
      expect(p.xpIntoLevel).toBeGreaterThanOrEqual(0);
      expect(p.xpIntoLevel).toBeLessThan(p.xpForNextLevel);
    }
  });

  it("clamps negative xp to level 1 progress", () => {
    expect(levelProgress(-5)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 50 });
  });
});

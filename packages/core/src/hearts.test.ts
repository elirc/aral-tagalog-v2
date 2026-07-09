import { describe, expect, it } from "vitest";
import {
  addHearts,
  fullHearts,
  HEART_REGEN_MS,
  loseHeart,
  MAX_HEARTS,
  msUntilNextHeart,
  regenerate,
} from "./hearts";

const T0 = 1_000_000_000_000;

describe("hearts", () => {
  it("loses hearts down to zero", () => {
    let s = fullHearts(T0);
    for (let i = 0; i < 7; i++) s = loseHeart(s, T0);
    expect(s.hearts).toBe(0);
  });

  it("regenerates one heart per interval, clamped at max", () => {
    let s = fullHearts(T0);
    s = loseHeart(s, T0);
    s = loseHeart(s, T0);
    expect(regenerate(s, T0 + HEART_REGEN_MS - 1).hearts).toBe(3);
    expect(regenerate(s, T0 + HEART_REGEN_MS).hearts).toBe(4);
    expect(regenerate(s, T0 + 10 * HEART_REGEN_MS).hearts).toBe(MAX_HEARTS);
  });

  it("keeps partial regen progress across reads", () => {
    let s = loseHeart(fullHearts(T0), T0);
    s = regenerate(s, T0 + HEART_REGEN_MS / 2);
    // half an interval later the heart should still arrive on schedule
    expect(msUntilNextHeart(s, T0 + HEART_REGEN_MS / 2)).toBe(HEART_REGEN_MS / 2);
  });

  it("refills fully or partially", () => {
    let s = fullHearts(T0);
    for (let i = 0; i < 4; i++) s = loseHeart(s, T0);
    expect(addHearts(s, 1, T0).hearts).toBe(2);
    expect(addHearts(s, "full", T0).hearts).toBe(MAX_HEARTS);
  });

  it("does not regenerate when time goes backwards", () => {
    const s = loseHeart(fullHearts(T0), T0);
    expect(regenerate(s, T0 - HEART_REGEN_MS).hearts).toBe(4);
  });
});

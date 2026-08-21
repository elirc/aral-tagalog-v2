import { describe, expect, it } from "vitest";
import { isLessonUnlocked } from "./review";
import { isTierUnlocked, suggestedTier, tierLessonIds, tierOfLesson, tierStatuses } from "./tiers";
import type { CourseTier, Unit } from "./types";

const ex = (id: string) => ({ id, type: "choice" as const, prompt: "p", answer: "x", distractors: ["y"] });
const lesson = (id: string) => ({ id, title: id, xp: 10, exercises: [ex(`${id}-a`)] });

const tiers: CourseTier[] = [
  { id: "t1", title: "Foundations" },
  { id: "t2", title: "Everyday" },
  { id: "t3", title: "Mastery" },
];

const units: Unit[] = [
  { id: "u1", title: "U1", tier: "t1", lessons: [lesson("a1"), lesson("a2")] },
  { id: "u2", title: "U2", tier: "t1", lessons: [lesson("a3")] },
  { id: "u3", title: "U3", tier: "t2", lessons: [lesson("b1"), lesson("b2")] },
  { id: "u4", title: "U4", tier: "t3", lessons: [lesson("c1")] },
];

const ctx = (unlockedTierIds: string[] = []) => ({ tiers, unlockedTierIds });
const ALL_T1 = ["a1", "a2", "a3"];

describe("tier helpers", () => {
  it("collects a tier's lessons in course order across units", () => {
    expect(tierLessonIds(units, "t1")).toEqual(ALL_T1);
    expect(tierOfLesson(units, "b2")).toBe("t2");
    expect(tierOfLesson(units, "nope")).toBeNull();
  });

  it("opens the first tier always and the next only when the previous is done", () => {
    expect(isTierUnlocked(units, "t1", [], ctx())).toBe(true);
    expect(isTierUnlocked(units, "t2", [], ctx())).toBe(false);
    expect(isTierUnlocked(units, "t2", ["a1", "a2"], ctx())).toBe(false);
    expect(isTierUnlocked(units, "t2", ALL_T1, ctx())).toBe(true);
  });

  it("opens a tier the learner placed into, without the previous one", () => {
    expect(isTierUnlocked(units, "t3", [], ctx(["t3"]))).toBe(true);
    // placement is per-tier: jumping to t3 does not open t2
    expect(isTierUnlocked(units, "t2", [], ctx(["t3"]))).toBe(false);
  });

  it("treats an unknown tier id as locked instead of throwing", () => {
    expect(isTierUnlocked(units, "ghost", ALL_T1, ctx(["ghost"]))).toBe(false);
  });

  it("reports per-tier completion and why each is open", () => {
    const s = tierStatuses(units, ["a1", "a2", "a3"], ctx(["t3"]));
    expect(s.map((x) => x.reason)).toEqual(["first", "earned", "placed"]);
    expect(s[0]!.lessonsDone).toBe(3);
    expect(s[0]!.fraction).toBe(1);
    expect(s[1]!.lessonsDone).toBe(0);
  });

  it("suggests the last open, unfinished tier for placement", () => {
    expect(suggestedTier(units, [], ctx())?.id).toBe("t1");
    expect(suggestedTier(units, ALL_T1, ctx())?.id).toBe("t2");
    expect(suggestedTier(units, [], ctx(["t3"]))?.id).toBe("t3");
  });
});

describe("isLessonUnlocked with tiers", () => {
  it("keeps linear order inside a tier", () => {
    expect(isLessonUnlocked(units, "a1", [], ctx())).toBe(true);
    expect(isLessonUnlocked(units, "a2", [], ctx())).toBe(false);
    expect(isLessonUnlocked(units, "a2", ["a1"], ctx())).toBe(true);
    // ...including across units in the same tier
    expect(isLessonUnlocked(units, "a3", ["a1"], ctx())).toBe(false);
    expect(isLessonUnlocked(units, "a3", ["a1", "a2"], ctx())).toBe(true);
  });

  it("locks a later tier's first lesson until its tier opens", () => {
    expect(isLessonUnlocked(units, "b1", ["a1", "a2"], ctx())).toBe(false);
    expect(isLessonUnlocked(units, "b1", ALL_T1, ctx())).toBe(true);
  });

  it("placement unlocks a tier's first lesson with nothing else completed", () => {
    // this is the whole point of tiers: no Foundations lessons required
    expect(isLessonUnlocked(units, "c1", [], ctx(["t3"]))).toBe(true);
    // but the lessons of the skipped tier stay locked
    expect(isLessonUnlocked(units, "b1", [], ctx(["t3"]))).toBe(false);
    // and order still applies inside the tier the learner jumped into
    expect(isLessonUnlocked(units, "b2", [], ctx(["t2"]))).toBe(false);
    expect(isLessonUnlocked(units, "b2", ["b1"], ctx(["t2"]))).toBe(true);
  });

  it("falls back to whole-course linear order for an untiered bundle", () => {
    const flat: Unit[] = units.map((u) => ({ ...u, tier: undefined }));
    expect(isLessonUnlocked(flat, "b1", [], {})).toBe(false);
    expect(isLessonUnlocked(flat, "b1", ALL_T1, {})).toBe(true);
    // and with no ctx at all — the pre-tiers call signature
    expect(isLessonUnlocked(flat, "a1", [])).toBe(true);
  });

  it("ignores tiers when the bundle declares none, even if units name them", () => {
    // content skew: a client on a newer bundle, a server on an older one
    expect(isLessonUnlocked(units, "c1", [], { unlockedTierIds: ["t3"] })).toBe(false);
    expect(isLessonUnlocked(units, "a1", [], { unlockedTierIds: ["t3"] })).toBe(true);
  });

  it("returns false for a lesson that is not in the course", () => {
    expect(isLessonUnlocked(units, "nope", ALL_T1, ctx())).toBe(false);
  });
});

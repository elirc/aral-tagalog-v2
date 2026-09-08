import { describe, expect, it } from "vitest";
import { findNextLesson, matchesSearch, searchVocab, playableLessonIds } from "./discovery";
import type { Unit } from "./types";
import { isLessonUnlocked } from "./review";

const lesson = (id: string) => ({ id, title: id, xp: 10, exercises: [] });
const units: Unit[] = [
  { id: "one", title: "One", tier: "basic", lessons: [lesson("a"), lesson("b")] },
  { id: "two", title: "Two", tier: "advanced", lessons: [lesson("c"), lesson("d")] },
];
const context = { tiers: [{ id: "basic", title: "Basic" }, { id: "advanced", title: "Advanced" }] };

describe("course discovery", () => {
  it("starts beginners at the first lesson", () => {
    expect(findNextLesson(units, [], context)?.lesson.id).toBe("a");
  });
  it("continues a placed learner in the later track", () => {
    expect(findNextLesson(units, [], { ...context, unlockedTierIds: ["advanced"] })?.lesson.id).toBe("c");
  });
  it("allows returning to a chosen earlier track", () => {
    expect(findNextLesson(units, ["c"], context, "basic")?.lesson.id).toBe("a");
  });
  it("never suggests a locked lesson, including a requested locked track", () => {
    expect(findNextLesson(units, ["a"], context, "advanced")?.lesson.id).toBe("b");
  });
  it("advances to the next track after completing the previous one", () => {
    expect(findNextLesson(units, ["a", "b"], context, "basic")?.lesson.id).toBe("c");
    expect(findNextLesson(units, ["a", "b", "c", "d"], context)).toBeNull();
  });
  it("supports flat courses and stale progress IDs", () => {
    const flat = units.map(({ tier, ...unit }) => unit);
    expect(findNextLesson(flat, ["a", "removed"])?.lesson.id).toBe("b");
    expect(findNextLesson([], [])).toBeNull();
  });
});

describe("search", () => {
  it("finds accented words, punctuation variants and terms across fields", () => {
    expect(matchesSearch(" araw araw ", "araw-araw")).toBe(true);
    expect(matchesSearch("kumusta hello", "Kumustá", "Hello there")).toBe(true);
    expect(matchesSearch("hello missing", "Hello there")).toBe(false);
  });
  it("searches notes and preserves the original entries and ordering", () => {
    const entries = [{ id: "a", lemma: "pô", translation: "politeness", notes: "formal" }];
    expect(searchVocab(entries, "po formal")).toEqual(entries);
    expect(searchVocab(entries, "  ")).toEqual(entries);
    expect(searchVocab(entries, "absent")).toEqual([]);
  });
});


describe("course-map availability", () => {
  it("matches existing row access for gaps, placement, historical access and stale IDs", () => {
    const ids = units.flatMap((unit) => unit.lessons.map((entry) => entry.id));
    for (const completed of [[], ["a"], ["a", "b"], ["c"], ["b", "d", "removed"], ids]) {
      for (const ctx of [context, { ...context, unlockedTierIds: ["advanced"] }]) {
        const available = playableLessonIds(units, completed, ctx);
        for (const id of ids) expect(available.has(id)).toBe(completed.includes(id) || isLessonUnlocked(units, id, completed, ctx));
      }
    }
  });
  it("supports flat metadata without loading exercise bodies", () => {
    const flat = units.map(({ tier, ...unit }) => ({ ...unit, lessons: unit.lessons.map(({ exercises, ...entry }) => entry) }));
    expect([...playableLessonIds(flat, ["a"])]).toEqual(["a", "b"]);
    expect([...playableLessonIds([], [])]).toEqual([]);
  });
});

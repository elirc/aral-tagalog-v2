import { describe, expect, it } from "vitest";
import { buildReviewLesson, isLessonUnlocked, REVIEW_LESSON_ID } from "./review";
import { PRACTICE_XP } from "./xp";
import type { Unit } from "./types";

const units: Unit[] = [
  {
    id: "u1",
    title: "Unit 1",
    lessons: [
      {
        id: "l1",
        title: "L1",
        xp: 10,
        exercises: [
          { id: "a", type: "choice", prompt: "p", answer: "x", distractors: ["y"] },
          { id: "b", type: "choice", prompt: "p", answer: "x", distractors: ["y"] },
        ],
      },
      {
        id: "l2",
        title: "L2",
        xp: 10,
        exercises: [{ id: "c", type: "choice", prompt: "p", answer: "x", distractors: ["y"] }],
      },
    ],
  },
  {
    id: "u2",
    title: "Unit 2",
    lessons: [
      {
        id: "l3",
        title: "L3",
        xp: 10,
        exercises: [{ id: "d", type: "choice", prompt: "p", answer: "x", distractors: ["y"] }],
      },
    ],
  },
];

describe("buildReviewLesson", () => {
  it("returns null when there is nothing to review", () => {
    expect(buildReviewLesson(units, [])).toBeNull();
  });

  it("builds a practice lesson from weak ids in queue order", () => {
    const lesson = buildReviewLesson(units, ["d", "a"]);
    expect(lesson).not.toBeNull();
    expect(lesson!.id).toBe(REVIEW_LESSON_ID);
    expect(lesson!.xp).toBe(PRACTICE_XP);
    // queue order (oldest mistake first), not course order
    expect(lesson!.exercises.map((e) => e.id)).toEqual(["d", "a"]);
  });

  it("skips ids that no longer exist in the bundle", () => {
    const lesson = buildReviewLesson(units, ["gone-in-v4", "c"]);
    expect(lesson!.exercises.map((e) => e.id)).toEqual(["c"]);
  });

  it("returns null when every weak id is stale", () => {
    expect(buildReviewLesson(units, ["gone-1", "gone-2"])).toBeNull();
  });

  it("caps the session at the requested size", () => {
    const lesson = buildReviewLesson(units, ["a", "b", "c", "d"], 2);
    expect(lesson!.exercises.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("isLessonUnlocked", () => {
  it("always unlocks the first lesson", () => {
    expect(isLessonUnlocked(units, "l1", [])).toBe(true);
  });

  it("locks a lesson until everything before it is complete", () => {
    expect(isLessonUnlocked(units, "l2", [])).toBe(false);
    expect(isLessonUnlocked(units, "l2", ["l1"])).toBe(true);
  });

  it("gates across unit boundaries", () => {
    expect(isLessonUnlocked(units, "l3", ["l1"])).toBe(false);
    expect(isLessonUnlocked(units, "l3", ["l1", "l2"])).toBe(true);
  });

  it("returns false for an unknown lesson id", () => {
    expect(isLessonUnlocked(units, "nope", ["l1", "l2", "l3"])).toBe(false);
  });
});

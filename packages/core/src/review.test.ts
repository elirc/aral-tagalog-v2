import { describe, expect, it } from "vitest";
import {
  buildReviewLesson,
  dueReviewIds,
  isLessonUnlocked,
  nextReviewAt,
  REVIEW_INTERVALS_MS,
  REVIEW_LESSON_ID,
  REVIEW_MAX_BOX,
} from "./review";
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

describe("review schedule selectors", () => {
  const DAY = 86_400_000;
  const NOW = 1_800_000_000_000;
  const reviewItems = {
    later: { box: 2, dueAt: NOW + 2 * DAY },
    old: { box: 0, dueAt: NOW - 5 * DAY },
    recent: { box: 1, dueAt: NOW - 1000 },
    exact: { box: 1, dueAt: NOW },
    tomorrow: { box: 1, dueAt: NOW + DAY },
  };

  it("publishes the 1/3/7/21-day ladder", () => {
    // UI copy and the reducer both read these; changing one reshuffles
    // every learner's schedule on the next fold
    expect(REVIEW_INTERVALS_MS).toEqual([1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY]);
    expect(REVIEW_MAX_BOX).toBe(4);
  });

  it("dueReviewIds returns only what is due, longest-overdue first", () => {
    expect(dueReviewIds({ reviewItems }, NOW)).toEqual(["old", "recent", "exact"]);
    expect(dueReviewIds({ reviewItems }, NOW - 1)).toEqual(["old", "recent"]);
    expect(dueReviewIds({ reviewItems }, NOW + 3 * DAY)).toEqual(["old", "recent", "exact", "tomorrow", "later"]);
  });

  it("breaks equal due times by id, whatever order the record was stored in", () => {
    const a = { z: { box: 0, dueAt: 5 }, m: { box: 0, dueAt: 5 }, a: { box: 0, dueAt: 5 } };
    const b = { a: a.a, z: a.z, m: a.m };
    expect(dueReviewIds({ reviewItems: a }, NOW)).toEqual(["a", "m", "z"]);
    expect(dueReviewIds({ reviewItems: b }, NOW)).toEqual(["a", "m", "z"]);
  });

  it("falls back to the flat queue on a legacy progress object", () => {
    expect(dueReviewIds({ weakExerciseIds: ["q", "p"] }, NOW)).toEqual(["q", "p"]);
    expect(dueReviewIds({}, NOW)).toEqual([]);
  });

  it("nextReviewAt is the soonest future due time, or null", () => {
    expect(nextReviewAt({ reviewItems }, NOW)).toBe(NOW + DAY);
    expect(nextReviewAt({ reviewItems }, NOW + 3 * DAY)).toBeNull();
    expect(nextReviewAt({}, NOW)).toBeNull();
  });
});

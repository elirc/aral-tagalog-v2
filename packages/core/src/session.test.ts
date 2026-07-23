import { describe, expect, it } from "vitest";
import {
  currentExercise,
  isPerfect,
  sessionProgress,
  sessionReviewOutcome,
  startSession,
  submitAnswer,
} from "./session";
import { lessonXp, PERFECT_BONUS_XP } from "./xp";
import type { Lesson } from "./types";

const lesson: Lesson = {
  id: "l1",
  title: "Test",
  xp: 10,
  exercises: [
    { id: "a", type: "choice", prompt: "p1", answer: "yes", distractors: ["no"] },
    { id: "b", type: "choice", prompt: "p2", answer: "oo", distractors: ["hindi"] },
  ],
};

describe("lesson session", () => {
  it("completes when all exercises are answered correctly", () => {
    let s = startSession(lesson);
    expect(sessionProgress(s)).toBe(0);
    ({ state: s } = submitAnswer(s, "yes"));
    expect(sessionProgress(s)).toBe(0.5);
    ({ state: s } = submitAnswer(s, "oo"));
    expect(s.done).toBe(true);
    expect(isPerfect(s)).toBe(true);
    expect(lessonXp(lesson, isPerfect(s))).toBe(10 + PERFECT_BONUS_XP);
  });

  it("re-queues wrong answers until solved and counts mistakes", () => {
    let s = startSession(lesson);
    const wrong = submitAnswer(s, "no");
    s = wrong.state;
    expect(wrong.correct).toBe(false);
    expect(wrong.correctAnswer).toBe("yes");
    expect(s.mistakes).toBe(1);
    // exercise "a" moved to the back; "b" is now current
    expect(currentExercise(s)?.id).toBe("b");
    ({ state: s } = submitAnswer(s, "oo"));
    expect(currentExercise(s)?.id).toBe("a");
    ({ state: s } = submitAnswer(s, "yes"));
    expect(s.done).toBe(true);
    expect(isPerfect(s)).toBe(false);
    expect(lessonXp(lesson, isPerfect(s))).toBe(10);
  });

  it("counts match_pairs mistakes but always advances", () => {
    const l: Lesson = {
      id: "l2",
      title: "Match",
      xp: 10,
      exercises: [{ id: "m", type: "match_pairs", pairs: [{ left: "aso", right: "dog" }] }],
    };
    let s = startSession(l);
    const out = submitAnswer(s, "", 2);
    expect(out.state.done).toBe(true);
    expect(out.state.mistakes).toBe(2);
    expect(out.correct).toBe(false);
  });

  it("records each missed exercise once, even after repeated wrong answers", () => {
    let s = startSession(lesson);
    ({ state: s } = submitAnswer(s, "no")); // a wrong -> requeued
    ({ state: s } = submitAnswer(s, "hindi")); // b wrong -> requeued
    ({ state: s } = submitAnswer(s, "no")); // a wrong again
    ({ state: s } = submitAnswer(s, "hindi")); // b wrong again
    expect(s.missedExerciseIds).toEqual(["a", "b"]);
  });

  it("marks match_pairs as missed only when it had wrong pairings", () => {
    const l: Lesson = {
      id: "l2",
      title: "Match",
      xp: 10,
      exercises: [
        { id: "m1", type: "match_pairs", pairs: [{ left: "aso", right: "dog" }] },
        { id: "m2", type: "match_pairs", pairs: [{ left: "pusa", right: "cat" }] },
      ],
    };
    let s = startSession(l);
    ({ state: s } = submitAnswer(s, "", 1));
    ({ state: s } = submitAnswer(s, "", 0));
    expect(s.missedExerciseIds).toEqual(["m1"]);
  });

  it("splits a finished session into missed and mastered exercises", () => {
    let s = startSession(lesson);
    ({ state: s } = submitAnswer(s, "no")); // miss a
    ({ state: s } = submitAnswer(s, "oo")); // master b
    ({ state: s } = submitAnswer(s, "yes")); // eventually solve a
    expect(s.done).toBe(true);
    expect(sessionReviewOutcome(s)).toEqual({
      missedExerciseIds: ["a"],
      masteredExerciseIds: ["b"],
    });
  });

  it("never counts unattempted exercises as mastered (abandoned session)", () => {
    let s = startSession(lesson);
    ({ state: s } = submitAnswer(s, "yes")); // solve a, never reach b
    expect(sessionReviewOutcome(s)).toEqual({
      missedExerciseIds: [],
      masteredExerciseIds: ["a"],
    });
  });
});

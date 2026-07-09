import { describe, expect, it } from "vitest";
import { currentExercise, isPerfect, sessionProgress, startSession, submitAnswer } from "./session";
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
});

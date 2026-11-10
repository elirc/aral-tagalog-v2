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

/** n single-answer exercises with ids e0..e(n-1); the right answer is "yes" */
const lessonOf = (n: number): Lesson => ({
  id: "ln",
  title: "N",
  xp: 10,
  exercises: Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    type: "choice" as const,
    prompt: `p${i}`,
    answer: "yes",
    distractors: ["no"],
  })),
});
const queueIds = (s: { lesson: Lesson; queue: number[] }) => s.queue.map((i) => s.lesson.exercises[i]!.id);

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
    // exercise "a" is re-queued behind "b" (only one other exercise is left,
    // so the retry goes last); "b" is now current
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

describe("retry placement", () => {
  it("brings a missed exercise back after three others, not at the very end", () => {
    // At the end of a 12-exercise lesson the retry arrived minutes later and
    // tested nothing about the correction the learner had just read.
    let s = startSession(lessonOf(7));
    ({ state: s } = submitAnswer(s, "no"));
    expect(queueIds(s)).toEqual(["e1", "e2", "e3", "e0", "e4", "e5", "e6"]);
  });

  it("goes last when fewer than three exercises remain", () => {
    let s = startSession(lessonOf(3));
    ({ state: s } = submitAnswer(s, "no"));
    expect(queueIds(s)).toEqual(["e1", "e2", "e0"]);
  });

  it("is never back-to-back while another exercise is left", () => {
    for (let n = 2; n <= 8; n++) {
      const s = startSession(lessonOf(n));
      const { state } = submitAnswer(s, "no");
      expect(currentExercise(state)?.id).not.toBe("e0");
    }
  });

  it("repeats immediately only when it is the last exercise standing", () => {
    let s = startSession(lessonOf(1));
    ({ state: s } = submitAnswer(s, "no"));
    expect(queueIds(s)).toEqual(["e0"]);
    expect(s.done).toBe(false);
    ({ state: s } = submitAnswer(s, "yes"));
    expect(s.done).toBe(true);
  });

  it("a second miss is re-spaced from where the learner is now", () => {
    let s = startSession(lessonOf(7));
    ({ state: s } = submitAnswer(s, "no")); // e0 -> behind e3
    for (let i = 0; i < 3; i++) ({ state: s } = submitAnswer(s, "yes")); // e1..e3
    expect(currentExercise(s)?.id).toBe("e0");
    ({ state: s } = submitAnswer(s, "no")); // miss again: 3 left -> goes last
    expect(queueIds(s)).toEqual(["e4", "e5", "e6", "e0"]);
    expect(s.missedExerciseIds).toEqual(["e0"]);
  });
});

describe("attempts", () => {
  it("counts every submitted answer, right, wrong or match", () => {
    let s = startSession(lesson);
    expect(s.attempts).toBe(0);
    ({ state: s } = submitAnswer(s, "no"));
    expect(s.attempts).toBe(1);
    ({ state: s } = submitAnswer(s, "oo"));
    expect(s.attempts).toBe(2);
    ({ state: s } = submitAnswer(s, "yes"));
    expect(s.attempts).toBe(3);

    const match: Lesson = {
      id: "l2",
      title: "Match",
      xp: 10,
      exercises: [{ id: "m", type: "match_pairs", pairs: [{ left: "aso", right: "dog" }] }],
    };
    expect(submitAnswer(startSession(match), "", 1).state.attempts).toBe(1);
  });

  it("differs between the missed attempt and its retry — the presentation salt", () => {
    // clients key the option layout on this; equal values would lay the
    // retry out exactly as the attempt that was just missed
    let s = startSession(lessonOf(5));
    const atMiss = s.attempts;
    ({ state: s } = submitAnswer(s, "no"));
    while (currentExercise(s)?.id !== "e0") ({ state: s } = submitAnswer(s, "yes"));
    expect(s.attempts).toBeGreaterThan(atMiss);
  });

  it("does not move once the session is done", () => {
    let s = startSession(lesson);
    ({ state: s } = submitAnswer(s, "yes"));
    ({ state: s } = submitAnswer(s, "oo"));
    expect(submitAnswer(s, "yes").state.attempts).toBe(2);
  });

  it("tolerates a session object created before the field existed", () => {
    const { attempts: _dropped, ...legacy } = startSession(lesson);
    const out = submitAnswer(legacy as ReturnType<typeof startSession>, "yes");
    expect(out.state.attempts).toBe(1);
  });
});

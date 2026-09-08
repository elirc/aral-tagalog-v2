import { describe, expect, it } from "vitest";
import { isPerfect, sessionXp, startSession, submitAnswer, type SessionState } from "./session";
import type { Exercise, Lesson } from "./types";
import { COMBO_MIN, MAX_COMBO_BONUS_XP, PERFECT_BONUS_XP, PRACTICE_XP } from "./xp";

const choice = (id: string): Exercise => ({
  id,
  type: "choice",
  prompt: "p",
  answer: "right",
  distractors: ["wrong"],
});

const lessonOf = (n: number): Lesson => ({
  id: "l1",
  title: "L1",
  xp: 10,
  exercises: Array.from({ length: n }, (_, i) => choice(`e${i + 1}`)),
});

/** Answer the current exercise correctly `n` times in a row. */
function runCorrect(s: SessionState, n: number): SessionState {
  let state = s;
  for (let i = 0; i < n; i++) state = submitAnswer(state, "right").state;
  return state;
}

describe("combo", () => {
  it("starts at zero and counts consecutive correct answers", () => {
    const s = startSession(lessonOf(5));
    expect(s.combo).toBe(0);
    expect(runCorrect(s, 3).combo).toBe(3);
  });

  it("pays nothing until COMBO_MIN, then 1 XP per further correct answer", () => {
    let s = startSession(lessonOf(8));
    for (let i = 1; i < COMBO_MIN; i++) {
      const out = submitAnswer(s, "right");
      expect(out.comboXpGained).toBe(0);
      s = out.state;
    }
    expect(s.comboBonusXp).toBe(0);
    const first = submitAnswer(s, "right");
    expect(first.comboXpGained).toBe(1);
    expect(first.state.comboBonusXp).toBe(1);
  });

  it("resets the run on a wrong answer but keeps the XP already earned", () => {
    const hot = runCorrect(startSession(lessonOf(8)), COMBO_MIN + 2);
    // answers 3, 4 and 5 each paid 1
    expect(hot.comboBonusXp).toBe(3);
    const missed = submitAnswer(hot, "wrong");
    expect(missed.comboXpGained).toBe(0);
    expect(missed.state.combo).toBe(0);
    expect(missed.state.comboBonusXp).toBe(3); // banked, not clawed back
    expect(missed.state.maxCombo).toBe(COMBO_MIN + 2);
  });

  it("caps the bonus at MAX_COMBO_BONUS_XP", () => {
    // a very long run: every answer past COMBO_MIN would otherwise pay 1
    const s = runCorrect(startSession(lessonOf(60)), 60);
    expect(s.combo).toBe(60);
    expect(s.comboBonusXp).toBe(MAX_COMBO_BONUS_XP);
  });

  it("continues the run through a clean match_pairs and breaks on a dirty one", () => {
    const lesson: Lesson = {
      id: "l2",
      title: "L2",
      xp: 10,
      exercises: [
        choice("e1"),
        { id: "m1", type: "match_pairs", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
        choice("e2"),
        { id: "m2", type: "match_pairs", pairs: [{ left: "c", right: "3" }, { left: "d", right: "4" }] },
      ],
    };
    let s = startSession(lesson);
    s = submitAnswer(s, "right").state; // combo 1
    s = submitAnswer(s, "", 0).state; // clean grid -> combo 2
    expect(s.combo).toBe(2);
    s = submitAnswer(s, "right").state; // combo 3
    expect(s.combo).toBe(3);
    const dirty = submitAnswer(s, "", 2); // two wrong pairings
    expect(dirty.correct).toBe(false);
    expect(dirty.state.combo).toBe(0);
    expect(dirty.state.mistakes).toBe(2);
    expect(dirty.state.maxCombo).toBe(3);
  });
});

describe("sessionXp", () => {
  it("adds the combo bonus to a perfect first-time completion", () => {
    const s = runCorrect(startSession(lessonOf(6)), 6);
    expect(s.done).toBe(true);
    expect(isPerfect(s)).toBe(true);
    // 6 correct: bonus starts on the 3rd -> 4 XP
    expect(s.comboBonusXp).toBe(6 - COMBO_MIN + 1);
    expect(sessionXp(s, false)).toBe(10 + PERFECT_BONUS_XP + s.comboBonusXp);
  });

  it("ignores the combo on practice replays, so a finished lesson can't be farmed", () => {
    const s = runCorrect(startSession(lessonOf(20)), 20);
    expect(s.comboBonusXp).toBeGreaterThan(0);
    expect(sessionXp(s, true)).toBe(PRACTICE_XP);
  });

  it("stays within what /sync will accept", () => {
    const s = runCorrect(startSession(lessonOf(40)), 40);
    // the server clamps to lessonXp(lesson, perfect) + MAX_COMBO_BONUS_XP
    expect(sessionXp(s, false)).toBeLessThanOrEqual(10 + PERFECT_BONUS_XP + MAX_COMBO_BONUS_XP);
  });
});

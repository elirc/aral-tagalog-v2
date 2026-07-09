import { describe, expect, it } from "vitest";
import { grade, gradePair, normalizeAnswer } from "./grading";
import type { ChoiceExercise, TranslateTapsExercise } from "./types";

describe("normalizeAnswer", () => {
  it("ignores case, punctuation, extra whitespace, and accents", () => {
    expect(normalizeAnswer("  Kumustá,  ka?! ")).toBe("kumusta ka");
  });

  it("treats ng/nang as equivalent when flagged", () => {
    expect(normalizeAnswer("kumain nang mabilis", { ngNang: true })).toBe(
      normalizeAnswer("kumain ng mabilis", { ngNang: true }),
    );
    // not inside words
    expect(normalizeAnswer("nangako", { ngNang: true })).toBe("nangako");
  });

  it("tolerates missing hyphens when flagged", () => {
    expect(normalizeAnswer("araw-araw", { hyphens: true })).toBe(
      normalizeAnswer("araw araw", { hyphens: true }),
    );
  });
});

const taps: TranslateTapsExercise = {
  id: "e1",
  type: "translate_taps",
  direction: "target_to_base",
  prompt: "Kumusta ka?",
  answer: "How are you?",
  accept: ["How are you doing?"],
  wordBank: ["How", "are", "you", "doing", "thanks"],
};

describe("grade", () => {
  it("accepts the canonical answer from tapped words", () => {
    expect(grade(taps, ["How", "are", "you"]).correct).toBe(true);
  });

  it("accepts alternates", () => {
    expect(grade(taps, "how are you doing").correct).toBe(true);
  });

  it("rejects wrong answers and returns the canonical answer", () => {
    const r = grade(taps, ["thanks"]);
    expect(r.correct).toBe(false);
    expect(r.correctAnswer).toBe("How are you?");
  });

  it("grades multiple choice exactly", () => {
    const ex: ChoiceExercise = {
      id: "e2",
      type: "choice",
      prompt: "good morning",
      answer: "Magandang umaga",
      distractors: ["Magandang gabi"],
    };
    expect(grade(ex, "Magandang umaga").correct).toBe(true);
    expect(grade(ex, "Magandang gabi").correct).toBe(false);
  });
});

describe("gradePair", () => {
  const ex = { pairs: [{ left: "aso", right: "dog" }, { left: "pusa", right: "cat" }] };
  it("matches correct pairs only", () => {
    expect(gradePair(ex, "aso", "dog")).toBe(true);
    expect(gradePair(ex, "aso", "cat")).toBe(false);
  });
});

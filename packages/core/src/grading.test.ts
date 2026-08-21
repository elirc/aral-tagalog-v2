import { describe, expect, it } from "vitest";
import { grade, gradeBlank, gradePair, normalizeAnswer } from "./grading";
import type { ArrangeExercise, ChoiceExercise, DialogueExercise, TranslateTapsExercise } from "./types";

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

const arrange: ArrangeExercise = {
  id: "a1",
  type: "arrange",
  prompt: "I will go to the market tomorrow.",
  answer: "Pupunta ako sa palengke bukas",
  accept: ["Bukas pupunta ako sa palengke"],
  tokens: ["palengke", "ako", "bukas", "Pupunta", "sa"],
};

describe("grade: arrange", () => {
  it("accepts the tokens in the right order", () => {
    expect(grade(arrange, ["Pupunta", "ako", "sa", "palengke", "bukas"]).correct).toBe(true);
  });

  it("rejects the right words in the wrong order", () => {
    const r = grade(arrange, ["Bukas", "ako", "pupunta", "sa", "palengke"]);
    expect(r.correct).toBe(false);
    expect(r.correctAnswer).toBe("Pupunta ako sa palengke bukas");
  });

  it("accepts an authored alternative ordering", () => {
    expect(grade(arrange, ["Bukas", "pupunta", "ako", "sa", "palengke"]).correct).toBe(true);
  });

  it("honours grading flags like every other built answer", () => {
    const hyphenated: ArrangeExercise = {
      id: "a2",
      type: "arrange",
      prompt: "He eats every day.",
      answer: "Kumakain siya araw-araw",
      tokens: ["araw-araw", "Kumakain", "siya"],
      grading: { hyphens: true },
    };
    expect(grade(hyphenated, ["Kumakain", "siya", "araw araw"]).correct).toBe(true);
  });
});

const dialogue: DialogueExercise = {
  id: "d1",
  type: "dialogue",
  intro: "At the market",
  lines: [
    { speaker: "Ikaw", text: "Magkano ___ ang mangga?" },
    { speaker: "Tindera", text: "Otsenta ___ ang isang kilo." },
  ],
  blanks: [
    { answer: "po", options: ["po", "ba", "na"] },
    { answer: "piso", accept: ["pesos"], options: ["piso", "pera"] },
  ],
};

describe("grade: dialogue", () => {
  it("needs every blank right", () => {
    expect(grade(dialogue, ["po", "piso"]).correct).toBe(true);
    expect(grade(dialogue, ["po", "pera"]).correct).toBe(false);
    expect(grade(dialogue, ["ba", "piso"]).correct).toBe(false);
  });

  it("accepts per-blank alternatives", () => {
    expect(grade(dialogue, ["po", "pesos"]).correct).toBe(true);
  });

  it("does not join the array into one sentence", () => {
    // the whole point of the dialogue branch: entries are per-blank, so a
    // single string that happens to contain both answers must not pass
    expect(grade(dialogue, "po piso").correct).toBe(false);
  });

  it("fails on missing or blank entries rather than throwing", () => {
    expect(grade(dialogue, ["po"]).correct).toBe(false);
    expect(grade(dialogue, ["po", ""]).correct).toBe(false);
    expect(grade(dialogue, []).correct).toBe(false);
  });

  it("ignores extra entries beyond the blank count", () => {
    expect(grade(dialogue, ["po", "piso", "junk"]).correct).toBe(true);
  });

  it("reports every answer for the miss message", () => {
    expect(grade(dialogue, ["ba", "pera"]).correctAnswer).toBe("po · piso");
  });

  it("grades a single blank on its own", () => {
    const one: DialogueExercise = {
      id: "d2",
      type: "dialogue",
      lines: [{ text: "Salamat ___." }, { text: "Walang anuman." }],
      blanks: [{ answer: "po" }],
    };
    expect(gradeBlank(one.blanks[0]!, "PO!")).toBe(true);
    expect(gradeBlank(one.blanks[0]!, "  ")).toBe(false);
    expect(grade(one, ["po"]).correct).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type {
  ChoiceExercise,
  Exercise,
  FillBlankExercise,
  Lesson,
  ListenExercise,
  MatchPairsExercise,
  TranslateTapsExercise,
  Unit,
} from "@aral/core";
import { validateCourse, validateExercise } from "./validate";

const choice = (over: Partial<ChoiceExercise> = {}): ChoiceExercise => ({
  id: "c1",
  type: "choice",
  prompt: "good morning",
  answer: "Magandang umaga",
  distractors: ["Magandang gabi", "Magandang hapon"],
  ...over,
});

const taps = (over: Partial<TranslateTapsExercise> = {}): TranslateTapsExercise => ({
  id: "t1",
  type: "translate_taps",
  direction: "target_to_base",
  prompt: "Kumusta ka?",
  answer: "How are you?",
  wordBank: ["How", "are", "you"],
  ...over,
});

describe("validateExercise: choice", () => {
  it("passes a clean exercise", () => {
    expect(validateExercise(choice())).toEqual([]);
  });

  it("flags the answer appearing among the distractors", () => {
    const problems = validateExercise(choice({ distractors: ["Magandang umaga", "Magandang gabi"] }));
    expect(problems).toEqual([`answer "Magandang umaga" also appears in distractors`]);
  });

  it("catches a case-only duplicate of the answer (comparison is normalized)", () => {
    const problems = validateExercise(choice({ distractors: ["magandang umaga"] }));
    expect(problems[0]).toMatch(/also appears in distractors/);
  });

  it("catches an accent-only duplicate of the answer", () => {
    const problems = validateExercise(choice({ distractors: ["Magandáng umaga"] }));
    expect(problems[0]).toMatch(/also appears in distractors/);
  });

  it("flags duplicate distractors, even when they differ only by case/punctuation", () => {
    const problems = validateExercise(choice({ distractors: ["Magandang gabi", "magandang gabi!"] }));
    expect(problems).toEqual(["duplicate distractors"]);
  });
});

describe("validateExercise: word-bank solvability (translate_taps / listen)", () => {
  it("passes when the bank can spell the answer", () => {
    expect(validateExercise(taps())).toEqual([]);
  });

  it("fails when the bank is missing a needed word", () => {
    const problems = validateExercise(taps({ wordBank: ["How", "are"] }));
    expect(problems[0]).toMatch(/cannot spell "How are you\?"/);
  });

  it("fails when the answer needs the same word twice but the bank holds one copy", () => {
    // "Mahal na mahal kita" needs "mahal" twice; each chip is consumable once
    const ex = taps({ answer: "Mahal na mahal kita", wordBank: ["Mahal", "na", "kita"] });
    expect(validateExercise(ex)).toHaveLength(1);
    expect(
      validateExercise(taps({ answer: "Mahal na mahal kita", wordBank: ["Mahal", "mahal", "na", "kita"] })),
    ).toEqual([]);
  });

  it("passes when an accept alternative is spellable even if the canonical answer is not", () => {
    const ex = taps({
      answer: "How are you doing?", // bank has no "doing"
      accept: ["How are you?"],
      wordBank: ["How", "are", "you"],
    });
    expect(validateExercise(ex)).toEqual([]);
  });

  it("handles a chip that normalizes to multiple tokens under the hyphens flag", () => {
    // regression: with hyphens: true, "Araw-araw" normalizes to "araw araw"
    // (two tokens) — naive per-token matching reported this solvable bank
    // as broken
    const ex = taps({
      answer: "Araw-araw nagtatrabaho ako.",
      wordBank: ["Araw-araw", "nagtatrabaho", "ako"],
      grading: { hyphens: true },
    });
    expect(validateExercise(ex)).toEqual([]);
  });

  it("ignores punctuation and case when matching the answer against chips", () => {
    const ex = taps({ answer: "HOW ARE YOU?!", wordBank: ["how", "are", "you"] });
    expect(validateExercise(ex)).toEqual([]);
  });

  it("applies the same rule to listen exercises", () => {
    const ex: ListenExercise = {
      id: "li1",
      type: "listen",
      audio: "kumusta_ka",
      answer: "Kumusta ka",
      wordBank: ["Kumusta"],
    };
    expect(validateExercise(ex)).toHaveLength(1);
  });
});

describe("validateExercise: match_pairs", () => {
  const pairs = (ps: Array<{ left: string; right: string }>): MatchPairsExercise => ({
    id: "m1",
    type: "match_pairs",
    pairs: ps,
  });

  it("passes distinct pairs", () => {
    expect(
      validateExercise(pairs([{ left: "aso", right: "dog" }, { left: "pusa", right: "cat" }])),
    ).toEqual([]);
  });

  it("fails on duplicate left values", () => {
    expect(
      validateExercise(pairs([{ left: "aso", right: "dog" }, { left: "aso", right: "cat" }])),
    ).toEqual(["duplicate left (target) values in pairs"]);
  });

  it("fails on duplicate right values", () => {
    expect(
      validateExercise(pairs([{ left: "aso", right: "dog" }, { left: "pusa", right: "dog" }])),
    ).toEqual(["duplicate right (base) values in pairs"]);
  });
});

describe("validateExercise: fill_blank", () => {
  const blank = (over: Partial<FillBlankExercise> = {}): FillBlankExercise => ({
    id: "f1",
    type: "fill_blank",
    sentence: "Kumain ako ___ mansanas.",
    answer: "ng",
    ...over,
  });

  it("fails when options are present but none matches the answer", () => {
    const problems = validateExercise(blank({ options: ["sa", "ang"] }));
    expect(problems).toEqual([`no option matches the answer "ng"`]);
  });

  it("passes when an option matches an accept alternative", () => {
    expect(validateExercise(blank({ accept: ["nang"], options: ["nang", "sa"] }))).toEqual([]);
  });

  it("passes when an option matches modulo case and punctuation", () => {
    expect(validateExercise(blank({ answer: "Kumusta", options: ["kumusta!", "salamat"] }))).toEqual([]);
  });

  it("never fails a free-text blank (no options)", () => {
    expect(validateExercise(blank())).toEqual([]);
  });
});

describe("validateCourse", () => {
  const lesson = (id: string, exercises: Exercise[]): Lesson => ({ id, title: id, xp: 10, exercises });
  const unit = (id: string, lessons: Lesson[]): Unit => ({ id, title: id, lessons });

  it("returns [] for a clean mini-course", () => {
    const units = [
      unit("u1", [lesson("l1", [choice({ id: "e1" })]), lesson("l2", [taps({ id: "e2" })])]),
      unit("u2", [lesson("l3", [choice({ id: "e3" })])]),
    ];
    expect(validateCourse(units, [{ id: "v1" }, { id: "v2" }])).toEqual([]);
  });

  it("reports duplicate lesson ids", () => {
    const units = [unit("u1", [lesson("l1", []), lesson("l1", [])])];
    expect(validateCourse(units, [])).toEqual(["duplicate lesson id: l1"]);
  });

  it("reports duplicate exercise ids across different lessons", () => {
    const units = [
      unit("u1", [lesson("l1", [choice({ id: "e1" })])]),
      unit("u2", [lesson("l2", [choice({ id: "e1" })])]),
    ];
    expect(validateCourse(units, [])).toEqual(["duplicate exercise id: e1"]);
  });

  it("reports duplicate vocab ids", () => {
    expect(validateCourse([], [{ id: "v1" }, { id: "v1" }])).toEqual(["duplicate vocab id: v1"]);
  });

  it("prefixes exercise-level problems with the exercise id", () => {
    const broken = choice({ id: "e9", distractors: ["Magandang gabi", "Magandang gabi"] });
    const units = [unit("u1", [lesson("l1", [broken])])];
    expect(validateCourse(units, [])).toEqual(["e9: duplicate distractors"]);
  });
});

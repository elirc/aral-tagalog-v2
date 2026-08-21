import type { DialogueBlank, DialogueExercise, Exercise, GradingFlags } from "./types";

/**
 * Normalize free-ish text for comparison: case, punctuation, whitespace,
 * diacritics (kumustá == kumusta), plus optional Tagalog-specific tolerance.
 */
export function normalizeAnswer(text: string, flags: GradingFlags = {}): string {
  let s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase();
  if (flags.hyphens) s = s.replace(/-/g, " ");
  s = s
    .replace(/[.,!?¡¿;:'"“”‘’()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (flags.ngNang) {
    s = s
      .split(" ")
      .map((w) => (w === "nang" ? "ng" : w))
      .join(" ");
  }
  return s;
}

export interface GradeResult {
  correct: boolean;
  /** canonical correct answer, for the "Correct answer:" UI on misses */
  correctAnswer: string;
}

/**
 * Answer shapes by exercise type. match_pairs is graded per-pair via gradePair.
 * `dialogue` takes a string[] parallel to its blanks — the only type whose
 * array entries are *not* joined into one sentence.
 */
export type UserAnswer = string | string[];

/** Is `value` an accepted filling for one dialogue blank? */
export function gradeBlank(blank: DialogueBlank, value: string, flags: GradingFlags = {}): boolean {
  const normalized = normalizeAnswer(value, flags);
  if (normalized === "") return false;
  return [blank.answer, ...(blank.accept ?? [])].some((a) => normalizeAnswer(a, flags) === normalized);
}

/**
 * A dialogue is correct only when every blank is. Extra entries beyond the
 * blank count are ignored; missing ones simply fail to match.
 */
export function gradeDialogue(exercise: DialogueExercise, userAnswer: UserAnswer): GradeResult {
  const given = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  const flags = exercise.grading ?? {};
  return {
    correct: exercise.blanks.every((b, i) => gradeBlank(b, given[i] ?? "", flags)),
    correctAnswer: exercise.blanks.map((b) => b.answer).join(" · "),
  };
}

export function grade(exercise: Exercise, userAnswer: UserAnswer): GradeResult {
  // dialogue answers stay an array (one entry per blank); everything else
  // flattens a word-bank selection into a sentence
  if (exercise.type === "dialogue") return gradeDialogue(exercise, userAnswer);
  const given = Array.isArray(userAnswer) ? userAnswer.join(" ") : userAnswer;

  switch (exercise.type) {
    case "choice": {
      return {
        correct: normalizeAnswer(given) === normalizeAnswer(exercise.answer),
        correctAnswer: exercise.answer,
      };
    }
    case "translate_taps":
    case "listen":
    case "arrange":
    case "fill_blank": {
      const flags = exercise.grading ?? {};
      const accepted = [exercise.answer, ...(exercise.accept ?? [])];
      const normalized = normalizeAnswer(given, flags);
      return {
        correct: accepted.some((a) => normalizeAnswer(a, flags) === normalized),
        correctAnswer: exercise.answer,
      };
    }
    case "match_pairs": {
      // Full-exercise grading is not meaningful here; UI grades pair by pair.
      return { correct: true, correctAnswer: "" };
    }
  }
}

/** Grade a single attempted pairing in a match_pairs exercise. */
export function gradePair(
  exercise: { pairs: Array<{ left: string; right: string }> },
  left: string,
  right: string,
): boolean {
  return exercise.pairs.some((p) => p.left === left && p.right === right);
}

import type { Exercise, GradingFlags } from "./types";

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

/** Answer shapes by exercise type. match_pairs is graded per-pair via gradePair. */
export type UserAnswer = string | string[];

export function grade(exercise: Exercise, userAnswer: UserAnswer): GradeResult {
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

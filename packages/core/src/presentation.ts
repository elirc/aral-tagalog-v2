import type { Exercise } from "./types";

/**
 * Deterministic presentation order for an exercise's choices.
 *
 * Both clients used to shuffle with a constant per-exercise seed, so an
 * exercise looked identical every time it came round: after one miss the
 * learner could answer the retry from *where* the right option sat, not from
 * what it said. Seeding with (exercise id, salt) keeps the layout stable
 * across re-renders of one attempt, and different on the next one — pass
 * `SessionState.attempts` as the salt.
 *
 * Pure and platform-free (no Math.random), so web and mobile lay the same
 * attempt out identically and tests can pin it.
 */

/** FNV-1a over UTF-16 code units → uint32 */
function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, well-mixed PRNG returning floats in [0, 1) */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A permutation of 0..length-1, fully determined by `seed`. Use this (rather
 * than seededShuffle) when items can repeat and callers track them by index,
 * e.g. a word bank holding the same word twice.
 */
export function seededOrder(length: number, seed: string | number): number[] {
  const n = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
  const out = Array.from({ length: n }, (_, i) => i);
  const rand = prng(hashSeed(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A shuffled copy of `items`, fully determined by `seed`. Never mutates. */
export function seededShuffle<T>(items: readonly T[], seed: string | number): T[] {
  return seededOrder(items.length, seed).map((i) => items[i]!);
}

export interface PresentationOrder {
  /**
   * Option buttons in display order. `choice`: the answer plus distractors.
   * `fill_blank`: its options (empty for the free-text variant). Empty for
   * every other type.
   */
  options: string[];
  /**
   * `translate_taps` / `listen`: indices into `exercise.wordBank` in display
   * order. Indices, not words, because a bank may hold the same word twice
   * and the views track picked tiles by bank index. Empty for other types.
   */
  wordBankOrder: number[];
  /** `match_pairs`: left column in display order. Empty for other types. */
  lefts: string[];
  /** `match_pairs`: right column, shuffled independently of the left. */
  rights: string[];
}

/**
 * How to lay out `exercise` for the attempt identified by `salt`. Same
 * (exercise.id, salt) → same order, always; a different salt → an
 * independent reshuffle.
 */
export function presentationOrder(exercise: Exercise, salt: number = 0): PresentationOrder {
  const seed = `${exercise.id}#${salt}`;
  const out: PresentationOrder = { options: [], wordBankOrder: [], lefts: [], rights: [] };
  switch (exercise.type) {
    case "choice":
      out.options = seededShuffle([exercise.answer, ...exercise.distractors], seed);
      break;
    case "fill_blank":
      out.options = seededShuffle(exercise.options ?? [], seed);
      break;
    case "translate_taps":
    case "listen":
      out.wordBankOrder = seededOrder(exercise.wordBank.length, seed);
      break;
    case "match_pairs":
      // separate streams, or the two columns would line up pair-for-pair
      out.lefts = seededShuffle(exercise.pairs.map((p) => p.left), `${seed}#left`);
      out.rights = seededShuffle(exercise.pairs.map((p) => p.right), `${seed}#right`);
      break;
  }
  return out;
}

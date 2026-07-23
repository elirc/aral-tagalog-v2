import { normalizeAnswer, type Exercise, type Unit } from "@aral/core";

/**
 * Semantic content checks Zod can't express: unsolvable or ambiguous
 * exercises that would ship as playable-but-broken, and id collisions that
 * would silently corrupt progress or grading. Pure functions so the compiler
 * and tests share one implementation.
 */

/** Problems with a single compiled exercise (empty array = fine). */
export function validateExercise(ex: Exercise): string[] {
  const problems: string[] = [];
  switch (ex.type) {
    case "choice": {
      const norm = (s: string) => normalizeAnswer(s);
      if (ex.distractors.some((d) => norm(d) === norm(ex.answer)))
        problems.push(`answer "${ex.answer}" also appears in distractors`);
      if (new Set(ex.distractors.map(norm)).size !== ex.distractors.length)
        problems.push("duplicate distractors");
      break;
    }
    case "translate_taps":
    case "listen": {
      // the word bank must be able to spell at least one accepted answer,
      // otherwise the exercise cannot be completed at all. A tapped chip can
      // normalize to several tokens (hyphens flag: "Araw-araw" -> "araw araw"),
      // so match chip token-lists against the answer sequence with backtracking.
      const flags = ex.grading ?? {};
      const chips = ex.wordBank.map((w) => normalizeAnswer(w, flags).split(" "));
      const formable = (answer: string) => {
        const target = normalizeAnswer(answer, flags).split(" ");
        const used = new Array<boolean>(chips.length).fill(false);
        const cover = (pos: number): boolean => {
          if (pos === target.length) return true;
          return chips.some((chip, i) => {
            if (used[i] || chip.some((t, k) => target[pos + k] !== t)) return false;
            used[i] = true;
            if (cover(pos + chip.length)) return true;
            used[i] = false;
            return false;
          });
        };
        return cover(0);
      };
      if (![ex.answer, ...(ex.accept ?? [])].some(formable))
        problems.push(`word bank [${ex.wordBank.join(", ")}] cannot spell "${ex.answer}" or any accepted alternative`);
      break;
    }
    case "match_pairs": {
      // duplicate values on either side make pairs visually indistinguishable,
      // so a correct-looking match can grade wrong (gradePair is exact)
      const lefts = ex.pairs.map((p) => p.left);
      const rights = ex.pairs.map((p) => p.right);
      if (new Set(lefts).size !== lefts.length) problems.push("duplicate left (target) values in pairs");
      if (new Set(rights).size !== rights.length) problems.push("duplicate right (base) values in pairs");
      break;
    }
    case "fill_blank": {
      if (ex.options) {
        const flags = ex.grading ?? {};
        const accepted = [ex.answer, ...(ex.accept ?? [])].map((a) => normalizeAnswer(a, flags));
        if (!ex.options.some((o) => accepted.includes(normalizeAnswer(o, flags))))
          problems.push(`no option matches the answer "${ex.answer}"`);
      }
      break;
    }
  }
  return problems;
}

/**
 * Course-wide checks: ids must be unique (lessons and exercises key progress
 * and grading; vocab collisions would silently drop entries when the bundle
 * map is built), plus every per-exercise check. Returns human-readable
 * problems; empty array means the course is publishable.
 */
export function validateCourse(units: Unit[], vocab: { id: string }[]): string[] {
  const problems: string[] = [];
  const seenLessons = new Set<string>();
  const seenExercises = new Set<string>();
  for (const u of units)
    for (const l of u.lessons) {
      if (seenLessons.has(l.id)) problems.push(`duplicate lesson id: ${l.id}`);
      seenLessons.add(l.id);
      for (const ex of l.exercises) {
        if (seenExercises.has(ex.id)) problems.push(`duplicate exercise id: ${ex.id}`);
        seenExercises.add(ex.id);
        for (const p of validateExercise(ex)) problems.push(`${ex.id}: ${p}`);
      }
    }
  const seenVocab = new Set<string>();
  for (const v of vocab) {
    if (seenVocab.has(v.id)) problems.push(`duplicate vocab id: ${v.id}`);
    seenVocab.add(v.id);
  }
  return problems;
}

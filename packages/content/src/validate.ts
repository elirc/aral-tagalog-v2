import { normalizeAnswer, type CourseTier, type Exercise, type GradingFlags, type Unit } from "@aral/core";

/**
 * Semantic content checks Zod can't express: unsolvable or ambiguous
 * exercises that would ship as playable-but-broken, and id collisions that
 * would silently corrupt progress or grading. Pure functions so the compiler
 * and tests share one implementation.
 */

/**
 * Can the chips spell `answer`? A tapped chip can normalize to several tokens
 * (hyphens flag: "Araw-araw" -> "araw araw"), so chip token-lists are matched
 * against the answer sequence with backtracking. Shared by every tap-to-build
 * exercise type (translate_taps, listen, arrange).
 */
function canSpell(chipWords: string[], answer: string, flags: GradingFlags): boolean {
  const chips = chipWords.map((w) => normalizeAnswer(w, flags).split(" "));
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
}

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
      // otherwise the exercise cannot be completed at all
      const flags = ex.grading ?? {};
      if (![ex.answer, ...(ex.accept ?? [])].some((a) => canSpell(ex.wordBank, a, flags)))
        problems.push(`word bank [${ex.wordBank.join(", ")}] cannot spell "${ex.answer}" or any accepted alternative`);
      break;
    }
    case "arrange": {
      const flags = ex.grading ?? {};
      if (![ex.answer, ...(ex.accept ?? [])].some((a) => canSpell(ex.tokens, a, flags)))
        problems.push(`tokens [${ex.tokens.join(", ")}] cannot spell "${ex.answer}" or any accepted alternative`);
      // arrange is a word-order drill: tokens already in answer order make it
      // a "tap left to right" freebie. Answers whose words are all the same
      // have no other order, so they're exempt.
      if (new Set(ex.tokens).size > 1 && normalizeAnswer(ex.tokens.join(" "), flags) === normalizeAnswer(ex.answer, flags))
        problems.push("tokens are already in answer order — nothing to arrange");
      // spare words would make it a translate exercise with a broken word bank
      const extra = ex.tokens.length - normalizeAnswer(ex.answer, flags).split(" ").length;
      if (extra > 0) problems.push(`${extra} token(s) beyond the answer — arrange takes no distractors`);
      break;
    }
    case "dialogue": {
      const flags = ex.grading ?? {};
      const holes = ex.lines.reduce((n, l) => n + (l.text.match(/___/g)?.length ?? 0), 0);
      // a mismatch silently shifts every later blank onto the wrong answer
      if (holes !== ex.blanks.length)
        problems.push(`${holes} blank(s) in the lines but ${ex.blanks.length} answer(s)`);
      ex.blanks.forEach((b, i) => {
        if (!b.options) return;
        const accepted = [b.answer, ...(b.accept ?? [])].map((a) => normalizeAnswer(a, flags));
        if (!b.options.some((o) => accepted.includes(normalizeAnswer(o, flags))))
          problems.push(`blank ${i + 1}: no option matches the answer "${b.answer}"`);
        if (new Set(b.options.map((o) => normalizeAnswer(o, flags))).size !== b.options.length)
          problems.push(`blank ${i + 1}: duplicate options`);
      });
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
 * Tier wiring: ids unique, every `unit.tier` declared, and each tier's units
 * contiguous in course order. Contiguity matters because unlocking is scoped
 * to a tier — a unit stranded in the middle of another tier would be reachable
 * in an order the course map never shows.
 */
export function validateTiers(units: Unit[], tiers: CourseTier[] | undefined): string[] {
  const problems: string[] = [];
  if (!tiers || tiers.length === 0) {
    const tiered = units.filter((u) => u.tier);
    if (tiered.length > 0)
      problems.push(`units name tiers (${tiered[0]!.id}) but course.yaml declares none`);
    return problems;
  }
  const ids = new Set<string>();
  for (const t of tiers) {
    if (ids.has(t.id)) problems.push(`duplicate tier id: ${t.id}`);
    ids.add(t.id);
  }
  const seenRuns = new Set<string>();
  let prev: string | null = null;
  for (const u of units) {
    if (!u.tier) {
      problems.push(`unit ${u.id} has no tier (course declares tiers, so every unit needs one)`);
      continue;
    }
    if (!ids.has(u.tier)) problems.push(`unit ${u.id} names undeclared tier "${u.tier}"`);
    if (u.tier !== prev) {
      if (seenRuns.has(u.tier))
        problems.push(`tier "${u.tier}" units are not contiguous (resumes at unit ${u.id})`);
      seenRuns.add(u.tier);
      prev = u.tier;
    }
  }
  for (const t of tiers)
    if (!units.some((u) => u.tier === t.id)) problems.push(`tier "${t.id}" has no units`);
  return problems;
}

/**
 * Course-wide checks: ids must be unique (lessons and exercises key progress
 * and grading; vocab collisions would silently drop entries when the bundle
 * map is built), plus every per-exercise and tier check. Returns human-readable
 * problems; empty array means the course is publishable.
 */
export function validateCourse(
  units: Unit[],
  vocab: { id: string }[],
  tiers?: CourseTier[],
): string[] {
  const problems: string[] = [];
  const seenUnits = new Set<string>();
  const seenLessons = new Set<string>();
  const seenExercises = new Set<string>();
  for (const u of units) {
    // unit ids key the course map's per-unit progress and the unit-complete
    // achievement; two units sharing one id render as separate cards whose
    // completion state is computed from the wrong lesson set
    if (seenUnits.has(u.id)) problems.push(`duplicate unit id: ${u.id}`);
    seenUnits.add(u.id);
    for (const l of u.lessons) {
      if (seenLessons.has(l.id)) problems.push(`duplicate lesson id: ${l.id}`);
      seenLessons.add(l.id);
      for (const ex of l.exercises) {
        if (seenExercises.has(ex.id)) problems.push(`duplicate exercise id: ${ex.id}`);
        seenExercises.add(ex.id);
        for (const p of validateExercise(ex)) problems.push(`${ex.id}: ${p}`);
      }
    }
  }
  problems.push(...validateTiers(units, tiers));
  const seenVocab = new Set<string>();
  for (const v of vocab) {
    if (seenVocab.has(v.id)) problems.push(`duplicate vocab id: ${v.id}`);
    seenVocab.add(v.id);
  }
  return problems;
}

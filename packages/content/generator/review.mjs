import { writeTextAtomically as writeFileSync } from "./write.mjs";
/** Reviewed, repeatable corrections for published generated lessons.
 * Keeps unit, lesson, exercise and audio IDs so saved progress remains valid.
 * Grammar references: https://www.hawaii.edu/filipino/Grammar_Topics/Grammar_3-2.html
 * https://seasite.niu.edu/trans/tagalog/Grammar%201/Adjectives/AdjComparison.htm
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { buildUnit } from "./build.mjs";
import { proofreadEnglish, repeatedTemporalClause, invalidNounAction } from "./proofread.mjs";
import { THEMES } from "./themes.mjs";
import { FOUNDATION_FOCUSES } from "./focus-foundation.mjs";
import { EVERYDAY_FOCUSES } from "./focus-everyday.mjs";
import { CONVERSATIONAL_FOCUSES } from "./focus-conversational.mjs";
import { MASTERY_FOCUSES } from "./focus-mastery.mjs";
import { ADJECTIVES } from "./lexicon.mjs";
import { comparative, equalityAdjective, superlative } from "./makers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const units = join(root, "course/en-tl/units");
const substitutions = new Map();
function oldForm(en, superlative) {
  if (/[^aeiou]y$/.test(en)) return en.slice(0, -1) + (superlative ? "iest" : "ier");
  if (/^(big|hot|thin|sad|wet|fat)$/.test(en)) return en + en.slice(-1) + (superlative ? "est" : "er");
  if (en.split(" ").length > 1 || en.length > 7) return (superlative ? "most " : "more ") + en;
  if (/e$/.test(en)) return en + (superlative ? "st" : "r");
  return en + (superlative ? "est" : "er");
}
for (const adjective of ADJECTIVES) {
  for (const [before, after] of [
    [`kasing${adjective.tl}`, equalityAdjective(adjective.tl)],
    [`more ${adjective.en}`, comparative(adjective.en)],
    [oldForm(adjective.en, false), comparative(adjective.en)],
    [oldForm(adjective.en, true), superlative(adjective.en)],
  ]) if (before !== after) substitutions.set(before, after);
}
const escaped = [...substitutions.keys()].sort((a,b) => b.length-a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const pattern = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
export function reviewedText(text) {
  return proofreadEnglish(text).replace(pattern, (word) => {
    const replacement = substitutions.get(word.toLowerCase());
    return /^[A-Z]/.test(word) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  });
}
const identityFields = new Set(["id", "audio", "audio_ref", "tier"]);
export function reviewValue(value, key = "") {
  if (identityFields.has(key)) return value;
  if (typeof value === "string") return reviewedText(value);
  if (Array.isArray(value)) return value.map((entry) => reviewValue(entry));
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([name, entry]) => [name, reviewValue(entry, name)]));
  return value;
}
const reviewMark = "# reviewed: v8-grammar-2";
const nounReviewMark = "# reviewed: v8-noun-actions-1";
const focuses = [...FOUNDATION_FOCUSES, ...EVERYDAY_FOCUSES, ...CONVERSATIONAL_FOCUSES, ...MASTERY_FOCUSES];
function containsInvalidNounAction(value) {
  if (typeof value === "string") return invalidNounAction(value);
  return value && typeof value === "object" && Object.values(value).some(containsInvalidNounAction);
}
function containsTemporalRepeat(value) {
  if (typeof value === "string") return repeatedTemporalClause(value);
  return value && typeof value === "object" && Object.values(value).some(containsTemporalRepeat);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let changed = 0, rebuilt = 0;
  for (const file of readdirSync(units).filter((name) => /^(18t-g|35r-g|51q-g|57g-g).*\.yaml$/.test(name))) {
    const path = join(units, file);
    const original = readFileSync(path, "utf8");
    const unit = parse(original);
    if (!unit || !Array.isArray(unit.lessons)) throw new Error("Invalid generated unit: " + file);
    let corrected = unit;
    // Rebuild only lessons whose semantic pairings require coordinated changes
    // to prompts, answers, word banks and distractors. Keep all progress IDs.
    const semanticReview = !original.includes(reviewMark) &&
      (/-comparison\.yaml$/.test(file) || /\b(hinog|magulang|sumundo|sumusundo|susundo|maglagay|naglagay|naglalagay|maglalagay|tugtog|himig)\b/.test(original) || containsTemporalRepeat(unit)) ||
      (!original.includes(nounReviewMark) && containsInvalidNounAction(unit));
    if (semanticReview) {
      const pair = THEMES.flatMap((theme) => focuses.map((focus) => ({ theme, focus })))
        .find(({theme, focus}) => focus.tier === unit.tier && file.endsWith("-" + theme.id + "-" + focus.id + ".yaml"));
      if (!pair) throw new Error("Unknown generated unit: " + file);
      corrected = null;
      for (let attempt = 0; attempt < 12 && !corrected; attempt++) corrected = buildUnit({
        ...pair, index: 1, seed: "review:v8:" + unit.id + ":" + attempt,
        // Correct existing drills independently: fixed polite phrases can be
        // shared across contexts, while each repaired unit remains deduplicated.
        seen: new Set(),
        xp: unit.lessons[0].xp, idFor: () => unit.id,
      });
      if (!corrected || corrected.lessons.length !== unit.lessons.length) throw new Error("Cannot safely review " + file);
      corrected.title = unit.title;
      corrected.lessons.forEach((lesson, i) => {
        const previous = unit.lessons[i];
        if (lesson.exercises.length !== previous.exercises.length) throw new Error("Exercise count changed: " + file);
        lesson.id = previous.id;
        lesson.exercises.forEach((exercise, j) => { if (previous.exercises[j].id) exercise.id = previous.exercises[j].id; });
      });
      rebuilt++;
    }
    const reviewed = reviewValue(corrected);
    if (!semanticReview && JSON.stringify(unit) === JSON.stringify(reviewed)) continue;
    writeFileSync(path, "# generated by generator/generate.mjs - edit the generator, not this file\n" +
      (semanticReview || original.includes(reviewMark) ? reviewMark + "\n" : "") +
      (semanticReview || original.includes(nounReviewMark) ? nounReviewMark + "\n" : "") + stringify(reviewed, { lineWidth: 0 }));
    changed++;
  }
  console.log("Reviewed " + changed + " units (" + rebuilt + " semantic rebuilds); progress identifiers preserved.");
}

/**
 * Turns a focus + theme into a finished unit: pool the sentences, then cut
 * them into lessons of nine exercises.
 *
 * Every exercise this file emits is checked against the same rules
 * `src/validate.ts` enforces at compile time (no answer hiding among the
 * distractors, no unspellable word bank, no already-ordered arrange), so a
 * failed check drops the exercise here instead of failing the build.
 */

import { bare, slug, wordCount } from "./grammar.mjs";
import { makeContext, themeSupports } from "./context.mjs";

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,!?¡¿;:'"“”‘’()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** generic English chips for word banks, filtered against the answer */
const EN_FILLER = [
  "always", "never", "again", "sometimes", "maybe", "already", "quickly", "slowly",
  "here", "there", "today", "please", "very", "little", "many", "other", "friend", "house",
];
/** generic Tagalog chips */
const TL_FILLER = [
  "ako", "siya", "kami", "sila", "ang", "ng", "sa", "na", "pa", "din", "lang", "ba",
  "hindi", "may", "wala", "dito", "doon", "mabuti", "salamat", "bukas",
];

// ---------------------------------------------------------------- sentences

/**
 * Draw unique sentences for one unit. `seen` is the course-wide set, so no two
 * generated units ever ship the same sentence.
 */
export function sentencePool(focus, ctx, rng, seen, target) {
  const makers = focus.makers.filter((m) => themeSupports(ctx.theme, m.needs));
  if (makers.length === 0) return [];
  const out = [];
  const local = new Set();
  for (let attempt = 0; attempt < target * 14 && out.length < target; attempt++) {
    const maker = makers[attempt % makers.length];
    let s;
    try {
      s = maker.make(rng, ctx);
    } catch {
      s = null;
    }
    if (!s || !s.tl || !s.en) continue;
    const key = norm(s.tl);
    if (key.length < 6 || local.has(key) || seen.has(key)) continue;
    // a sentence that lost its blank target is still usable, just less flexible
    local.add(key);
    seen.add(key);
    out.push(s);
  }
  return out;
}

// -------------------------------------------------------------- small utils

function blank(sentence, word) {
  const tokens = bare(sentence).split(" ");
  const target = norm(word);
  const i = tokens.findIndex((t) => norm(t) === target);
  if (i === -1) return null;
  const answer = tokens[i].replace(/[.,!?]+$/, "");
  const punct = sentence.slice(bare(sentence).length);
  tokens[i] = "___";
  return { sentence: tokens.join(" ") + punct, answer };
}

function distinct(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = norm(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function fillers(answer, pool, n, rng) {
  const used = new Set(norm(answer).split(" "));
  return rng.sample(pool.filter((w) => !used.has(norm(w))), n);
}

// ------------------------------------------------------------- exercises

function exTranslateToBase(s, rng, glosses) {
  const extras = fillers(s.en, [...glosses.map((g) => g.en.split(" ")[0]), ...EN_FILLER], 3, rng);
  return {
    type: "translate",
    prompt_tl: s.tl,
    answer_en: s.en,
    ...(s.accept.length ? { accept: s.accept } : {}),
    ...(extras.length ? { extra_words: extras } : {}),
  };
}

function exTranslateToTarget(s, rng, glosses) {
  const extras = fillers(s.tl, [...glosses.map((g) => g.tl.split(" ")[0]), ...TL_FILLER], 3, rng);
  return {
    type: "translate",
    prompt_en: s.en,
    answer_tl: s.tl,
    ...(s.acceptTl.length ? { accept: s.acceptTl } : {}),
    ...(extras.length ? { extra_words: extras } : {}),
  };
}

function exListen(s, rng, glosses) {
  const answer = bare(s.tl);
  if (wordCount(answer) < 2) return null;
  const extras = fillers(answer, [...glosses.map((g) => g.tl.split(" ")[0]), ...TL_FILLER], 2, rng);
  return {
    type: "listen",
    audio: slug(answer),
    answer_tl: answer,
    accept: [s.tl],
    ...(extras.length ? { extra_words: extras } : {}),
  };
}

function exFillBlank(s) {
  if (!s.key) return null;
  const hole = blank(s.tl, s.key.word);
  if (!hole) return null;
  // a blank at the start of the sentence takes capitalized options, so the
  // shape of the word never gives the answer away
  const initial = hole.sentence.startsWith("___");
  const opts = distinct([hole.answer, ...s.key.options].map((o) => (initial ? cap(o) : o)));
  if (opts.length < 2) return null;
  return {
    type: "fill_blank",
    sentence: hole.sentence,
    translation: s.en,
    answer: hole.answer,
    options: opts.slice(0, 3),
  };
}

function exArrange(s) {
  const answer = bare(s.tl);
  const words = answer.replace(/[.,!?¡¿;:]/g, "").split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 9) return null;
  // the compiler scrambles these tokens and rejects an order that matches the
  // answer; a sentence repeating a word ("Hindi, hindi ako...") can shuffle
  // into an order that only differs by case, which trips that check
  if (new Set(words.map(norm)).size !== words.length) return null;
  if (/["“”]/.test(answer)) return null;
  return { type: "arrange", prompt: s.en, answer_tl: answer };
}

function exMatch(glosses, rng) {
  const pairs = [];
  const left = new Set();
  const right = new Set();
  for (const g of rng.shuffle(glosses)) {
    const l = g.tl.trim();
    const r = g.en.trim();
    if (!l || !r || left.has(norm(l)) || right.has(norm(r))) continue;
    if (l.split(" ").length > 4) continue;
    left.add(norm(l));
    right.add(norm(r));
    pairs.push({ tl: l, en: r });
    if (pairs.length === 4) break;
  }
  return pairs.length >= 3 ? { type: "match", pairs } : null;
}

function exChoiceWord(glosses, rng) {
  const pool = rng.shuffle(glosses).filter((g) => g.tl.split(" ").length <= 3);
  if (pool.length < 4) return null;
  // "kilo" -> Kilo answers itself; loanwords make a free point, not a question
  const answerable = pool.filter((g) => {
    const tl = norm(g.tl);
    const en = norm(g.en);
    return en.length >= 3 && !tl.startsWith(en) && !en.startsWith(tl) && !tl.split(" ").includes(en);
  });
  if (answerable.length === 0) return null;
  const answer = answerable[0];
  const rest = pool.filter((g) => g !== answer);
  const distractors = distinct(rest.map((g) => cap(g.en))).filter((d) => norm(d) !== norm(answer.en)).slice(0, 3);
  if (distractors.length < 2) return null;
  const single = answer.tl.split(" ").length === 1;
  return {
    type: "choice",
    prompt: `"${answer.tl}" means…`,
    answer: cap(answer.en),
    distractors,
    ...(single ? { audio: slug(answer.tl), audio_text: answer.tl } : {}),
  };
}

function exChoiceSentence(s, rng) {
  if (!s.key) return null;
  const hole = blank(s.tl, s.key.word);
  if (!hole) return null;
  const alternates = distinct(s.key.options).filter((o) => norm(o) !== norm(hole.answer)).slice(0, 2);
  if (alternates.length < 2) return null;
  const fill = (word) => hole.sentence.replace("___", hole.sentence.startsWith("___") ? cap(word) : word);
  const answer = fill(hole.answer);
  // "Mura ang ang baka" reads as a typo rather than a wrong answer
  const distractors = alternates.map(fill).filter((d) => !/\b(\w+) \1\b/i.test(d));
  const clean = distinct([answer, ...distractors]);
  if (clean.length < 3) return null;
  return {
    type: "choice",
    prompt: `Which one means "${s.en}"?`,
    answer,
    distractors: clean.slice(1),
  };
}

function exDialogue(qa, theme, rng) {
  if (!qa || !qa.q || !qa.a) return null;
  const lines = [];
  const blanks = [];
  const names = rng.sample(["Ana", "Ben", "Rosa", "Lito", "Mila", "Jun"], 2);
  for (const [i, part] of [qa.q, qa.a].entries()) {
    const hole = part.key ? blank(part.tl, part.key.word) : null;
    if (hole) {
      const opts = distinct([hole.answer, ...part.key.options]).slice(0, 3);
      if (opts.length >= 2 && !hole.sentence.startsWith("___")) {
        lines.push({ speaker: names[i], text: hole.sentence, translation: part.en });
        blanks.push({ answer: hole.answer, options: opts });
        continue;
      }
    }
    lines.push({ speaker: names[i], text: part.tl, translation: part.en });
  }
  if (blanks.length === 0 || lines.length < 2) return null;
  return { type: "dialogue", intro: theme.scene, lines, blanks };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------- assembly

/** exercise order per lesson — four shapes so a unit does not feel repetitive */
const RECIPES = [
  ["match", "choiceWord", "toBase", "fill", "listen", "toTarget", "arrange", "choiceSentence", "toBase"],
  ["choiceWord", "match", "toTarget", "listen", "fill", "arrange", "toBase", "choiceSentence", "dialogue"],
  ["match", "toBase", "choiceWord", "fill", "arrange", "listen", "toTarget", "choiceSentence", "toTarget"],
  ["dialogue", "match", "toBase", "fill", "listen", "arrange", "toTarget", "choiceWord", "choiceSentence"],
];

/**
 * Build one unit. Returns null when the theme cannot feed this focus with
 * enough distinct material to fill four lessons.
 */
export function buildUnit({ focus, theme, index, seed, seen, xp, idFor }) {
  const rng = seedRng(seed);
  const ctx = makeContext(theme, rng);
  const sentences = sentencePool(focus, ctx, rng, seen, 26);
  if (sentences.length < 8) return null;

  const glosses = dedupeGlosses(sentences.flatMap((s) => s.gloss));
  if (glosses.length < 4) return null;

  const lessons = [];
  const unitId = idFor(`${theme.id}-${focus.id}`);
  let cursor = 0;
  const nextSentence = (predicate) => {
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[(cursor + i) % sentences.length];
      if (!predicate || predicate(s)) {
        cursor = (cursor + i + 1) % sentences.length;
        return s;
      }
    }
    return sentences[cursor++ % sentences.length];
  };

  for (let li = 0; li < 4; li++) {
    const exercises = [];
    for (const step of RECIPES[li]) {
      let ex = null;
      switch (step) {
        case "match":
          ex = exMatch(glosses, rng);
          break;
        case "choiceWord":
          ex = exChoiceWord(glosses, rng);
          break;
        case "toBase":
          ex = exTranslateToBase(nextSentence((s) => !s.q || true), rng, glosses);
          break;
        case "toTarget":
          ex = exTranslateToTarget(nextSentence(), rng, glosses);
          break;
        case "listen":
          ex = exListen(nextSentence((s) => wordCount(s.tl) <= 8), rng, glosses);
          break;
        case "fill":
          ex = exFillBlank(nextSentence((s) => Boolean(s.key)));
          break;
        case "arrange":
          ex = exArrange(nextSentence((s) => wordCount(s.tl) >= 4 && wordCount(s.tl) <= 9));
          break;
        case "choiceSentence":
          ex = exChoiceSentence(nextSentence((s) => Boolean(s.key)), rng);
          break;
        case "dialogue":
          ex = exDialogue(safeQa(focus, rng, ctx), theme, rng);
          break;
        default:
          ex = null;
      }
      // a step that cannot be built for this material falls back to a
      // translation, which any sentence can always produce
      if (!ex) ex = exTranslateToBase(nextSentence(), rng, glosses);
      exercises.push(ex);
    }
    lessons.push({
      id: `${unitId}-l${li + 1}`,
      title: focus.lessonTitles[li] ?? `Practice ${li + 1}`,
      xp,
      exercises,
    });
  }

  return {
    id: unitId,
    title: `${theme.title}: ${focus.title}${index > 1 ? ` ${index}` : ""}`,
    tier: focus.tier,
    description: `${focus.title} — practised through ${theme.title.toLowerCase()} words.`,
    tip: focus.tip,
    lessons,
  };
}

function safeQa(focus, rng, ctx) {
  if (!focus.qa) return null;
  try {
    return focus.qa(rng, ctx);
  } catch {
    return null;
  }
}

function dedupeGlosses(glosses) {
  const seenTl = new Set();
  const seenEn = new Set();
  const out = [];
  for (const g of glosses) {
    if (!g || !g.tl || !g.en) continue;
    const tl = norm(g.tl);
    const en = norm(g.en);
    if (seenTl.has(tl) || seenEn.has(en)) continue;
    seenTl.add(tl);
    seenEn.add(en);
    out.push({ tl: g.tl.trim(), en: g.en.trim() });
  }
  return out;
}

// re-exported so generate.mjs seeds every unit the same way
export { seedRng };
import { rngFrom } from "./grammar.mjs";
function seedRng(seed) {
  return rngFrom(seed);
}

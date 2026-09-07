/**
 * Tagalog surface rules shared by every sentence template.
 *
 * Everything here is deliberately mechanical: templates hand it words from
 * lexicon.mjs and it produces the marked-up Tagalog string plus the matching
 * English. Where a rule has exceptions the lexicon carries an explicit
 * override (irregular plural, mass noun, verb forms) rather than the code
 * guessing — a wrong guess would ship as a playable-but-wrong exercise.
 */

// ---------------------------------------------------------------- randomness

/** FNV-1a over a string -> 32-bit seed, so a unit's content is reproducible. */
export function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic. */
export function rngFrom(seed) {
  let a = typeof seed === "string" ? hash(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  /** n distinct members of arr (or as many as it holds) */
  next.sample = (arr, n) => {
    const pool = [...arr];
    const out = [];
    while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    return out;
  };
  next.shuffle = (arr) => next.sample(arr, arr.length);
  next.chance = (p) => next() < p;
  return next;
}

// ------------------------------------------------------------------- strings

export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** audio ref / id slug: ascii, lowercase, underscore-separated */
export function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function kebab(s) {
  return slug(s).replace(/_/g, "-");
}

/**
 * The linker (ligature) that joins a modifier to what it modifies:
 * a vowel-final word takes -ng (maganda + bahay = magandang bahay), an
 * n-final word takes -g (malinis stays malinis na, but sarili -> sariling),
 * anything else takes a separate "na" (mabait na tao).
 */
export function ligate(word) {
  const last = word.slice(-1).toLowerCase();
  if ("aeiou".includes(last)) return `${word}ng`;
  if (last === "n") return `${word}g`;
  return `${word} na`;
}

/** "malaki" + "bahay" -> "malaking bahay" */
export function modify(modifier, head) {
  return `${ligate(modifier)} ${head}`;
}

// ------------------------------------------------------------- English nouns

const VOWELISH = /^[aeiou]/i;
/** heads whose spelling and sound disagree about "a" vs "an" */
const ART_OVERRIDE = { hour: "an", uniform: "a", university: "a", used: "a", one: "a" };

export function article(en) {
  const head = en.split(" ")[0].toLowerCase();
  if (ART_OVERRIDE[head]) return ART_OVERRIDE[head];
  return VOWELISH.test(head) ? "an" : "a";
}

export function plural(noun) {
  if (noun.pl) return noun.pl;
  const en = noun.en;
  if (/(s|sh|ch|x|z)$/.test(en)) return `${en}es`;
  if (/[^aeiou]y$/.test(en)) return `${en.slice(0, -1)}ies`;
  return `${en}s`;
}

/**
 * English noun phrase. `def` picks "the", `plural` the plural form, and mass
 * nouns (rice, water, money) take no indefinite article at all.
 */
export function enNP(noun, { def = false, plural: isPlural = false } = {}) {
  if (noun.proper) return noun.en;
  if (isPlural) return def ? `the ${plural(noun)}` : plural(noun);
  if (def) return `the ${noun.en}`;
  if (noun.mass) return noun.en;
  return `${article(noun.en)} ${noun.en}`;
}

// ------------------------------------------------------------- Tagalog nouns

/** "ang mga mansanas", "ng kape", "sa palengke" */
export function tlNP(noun, { marker = null, plural: isPlural = false } = {}) {
  const head = isPlural ? `mga ${noun.tl}` : noun.tl;
  return marker ? `${marker} ${head}` : head;
}

/** English location phrase honouring the place's own preposition */
export function atThe(place) {
  return `${place && place.prep ? place.prep : "at"} the ${place.en}`;
}

// ----------------------------------------------------------------- pronouns

/**
 * The three pronoun cases Tagalog marks. `ang` is the topic set, `ng` marks
 * the actor of an object-focus verb (and possession), `sa` is the oblique.
 * The `ang` form of "you" is the enclitic "ka", which has to follow the first
 * word of the predicate; `front` holds the standalone "ikaw".
 */
export const PRONOUNS = [
  { id: "ako", ang: "ako", front: "ako", ng: "ko", sa: "akin", en: "I", enObj: "me", poss: "my", be: "am", past: "was", third: false, plural: false },
  { id: "ikaw", ang: "ka", front: "ikaw", ng: "mo", sa: "iyo", en: "you", enObj: "you", poss: "your", be: "are", past: "were", third: false, plural: false },
  { id: "siya", ang: "siya", front: "siya", ng: "niya", sa: "kaniya", en: "he", enObj: "him", poss: "his", be: "is", past: "was", third: true, plural: false },
  { id: "kami", ang: "kami", front: "kami", ng: "namin", sa: "amin", en: "we", enObj: "us", poss: "our", be: "are", past: "were", third: false, plural: true },
  { id: "tayo", ang: "tayo", front: "tayo", ng: "natin", sa: "atin", en: "we", enObj: "us", poss: "our", be: "are", past: "were", third: false, plural: true },
  { id: "kayo", ang: "kayo", front: "kayo", ng: "ninyo", sa: "inyo", en: "you", enObj: "you", poss: "your", be: "are", past: "were", third: false, plural: true },
  { id: "sila", ang: "sila", front: "sila", ng: "nila", sa: "kanila", en: "they", enObj: "them", poss: "their", be: "are", past: "were", third: false, plural: true },
];

export const PRONOUN = Object.fromEntries(PRONOUNS.map((p) => [p.id, p]));
/** the subset that keeps early-tier sentences short and natural */
export const CORE_PRONOUNS = [PRONOUN.ako, PRONOUN.ikaw, PRONOUN.siya];

/**
 * "siya" is genderless, so every English rendering of it is only one of two
 * right answers. Templates run their English through this and hand the result
 * to `accept:` so a learner who types "she" is never marked wrong.
 */
export function genderVariants(en) {
  if (!/\b(he|him|his|He|Him|His)\b/.test(en)) return [];
  const swapped = en
    .replace(/\bHe\b/g, "She")
    .replace(/\bhe\b/g, "she")
    .replace(/\bHis\b/g, "Her")
    .replace(/\bhis\b/g, "her")
    .replace(/\bHim\b/g, "Her")
    .replace(/\bhim\b/g, "her");
  return swapped === en ? [] : [swapped];
}

// -------------------------------------------------------------------- verbs

/**
 * Actor-focus form for an aspect. Every form is authored in the lexicon (no
 * infixing at runtime) because -um- placement and CV reduplication have
 * enough exceptions that deriving them would ship wrong Tagalog.
 */
export function vf(verb, aspect) {
  const form = verb.f[aspect];
  if (!form) throw new Error(`verb ${verb.id} has no ${aspect} form`);
  return form;
}

/** object-focus form, when the verb declares one */
export function ovf(verb, aspect) {
  return verb.o ? verb.o[aspect] ?? null : null;
}

/**
 * English verb phrase matching a Tagalog aspect.
 *   comp -> simple past          ("ate")
 *   prog -> present progressive  ("is eating"), or habitual ("eats") when the
 *           sentence carries a frequency adverb — Tagalog uses one form here
 *   cont -> future               ("will eat")
 *   inf  -> bare stem            ("eat")
 */
export function enVerb(verb, aspect, subj, { habitual = false } = {}) {
  const e = verb.en;
  switch (aspect) {
    case "comp":
      return e.past;
    case "prog":
      return habitual ? (subj.third ? e.s : e.base) : `${subj.be} ${e.ing}`;
    case "cont":
      return `will ${e.base}`;
    case "inf":
    case "imp":
      return e.base;
    default:
      throw new Error(`unknown aspect ${aspect}`);
  }
}

/** stand-in subject record for a third-person noun ("the teacher is eating") */
export function nounSubj({ plural: isPlural = false } = {}) {
  return { third: !isPlural, be: isPlural ? "are" : "is", past: isPlural ? "were" : "was", plural: isPlural };
}

// ------------------------------------------------------------- sentence bits

function join(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .trim();
}

/** join, tidy, capitalize and punctuate a Tagalog sentence */
export function tlSentence(parts, { q = false, bang = false } = {}) {
  return cap(join(parts)) + (q ? "?" : bang ? "!" : ".");
}

/** same for the English gloss */
export function enSentence(parts, { q = false, bang = false } = {}) {
  return cap(join(parts)) + (q ? "?" : bang ? "!" : ".");
}

/** strip trailing punctuation — `arrange` answers are bare word sequences */
export function bare(sentence) {
  return sentence.replace(/[.?!]+$/, "");
}

/** word count the way the compiler counts it (punctuation stripped) */
export function wordCount(sentence) {
  return sentence.replace(/[.,!?¡¿;:]/g, "").split(/\s+/).filter(Boolean).length;
}

/** does a sentence already contain this word? (case/punctuation insensitive) */
export function hasWord(sentence, word) {
  const w = slug(word);
  return sentence
    .replace(/[.,!?¡¿;:]/g, "")
    .split(/\s+/)
    .some((t) => slug(t) === w);
}

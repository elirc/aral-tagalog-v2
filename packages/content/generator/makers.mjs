/**
 * Reusable sentence makers: the parameterised builders that the grammar
 * focuses in templates.mjs compose. Each maker returns one `sentence` record:
 *
 *   { tl, en, accept[], acceptTl[], key{word,options}, gloss[], q }
 *
 * `key` names the word a fill_blank should hide (it must occur exactly once in
 * `tl`) together with same-class distractor options; `gloss` are word pairs
 * worth drilling in match/choice exercises.
 */

import {
  bare,
  enNP,
  enSentence,
  enVerb,
  genderVariants,
  hasWord,
  ligate,
  modify,
  tlSentence,
  vf,
  atThe,
} from "./grammar.mjs";

/** build a sentence record, filling in the gender alternates automatically */
export function S({ tl, en, key = null, gloss = [], q = false, accept = [], acceptTl = [] }) {
  return {
    tl,
    en,
    accept: [...new Set([...accept, ...genderVariants(en), ...accept.flatMap(genderVariants)])],
    acceptTl,
    key: key && hasWord(tl, key.word) ? key : null,
    gloss,
    q,
  };
}

/** answer + up to `n` distinct distractors, answer first */
export function options(answer, pool, n = 2) {
  const seen = new Set([answer.toLowerCase()]);
  const out = [answer];
  for (const c of pool) {
    if (out.length > n) break;
    const k = String(c).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** the other two aspect forms of a verb, as fill_blank distractors */
export function aspectOptions(verb, aspect) {
  const order = ["comp", "prog", "cont", "inf"].filter((x) => x !== aspect);
  return options(vf(verb, aspect), order.map((x) => verb.f[x]));
}

/** English preposition for a place adjunct, per verb */
const PREP = {
  punta: "to the",
  tira: "in the",
  pasok: "into the",
  balik: "to the",
  bisita: "",
  uwi: "to the",
  alis: "from the",
  akyat: "up the",
  baba: "down the",
};
export function prepFor(verb, place = null) {
  if (PREP[verb.id] !== undefined) return PREP[verb.id];
  return `${place && place.prep ? place.prep : "at"} the`;
}

/** English verb phrase with do-support negation */
export function enNegVerb(verb, aspect, subj, { habitual = false } = {}) {
  const e = verb.en;
  switch (aspect) {
    case "comp":
      return { main: `didn't ${e.base}`, alt: `did not ${e.base}` };
    case "prog":
      return habitual
        ? { main: `${subj.third ? "doesn't" : "don't"} ${e.base}`, alt: `${subj.third ? "does not" : "do not"} ${e.base}` }
        : { main: `${subj.be} not ${e.ing}`, alt: `${subj.be === "am" ? "am" : subj.be === "is" ? "isn't" : "aren't"} ${e.ing}` };
    case "cont":
      return { main: `won't ${e.base}`, alt: `will not ${e.base}` };
    default:
      return { main: `don't ${e.base}`, alt: `do not ${e.base}` };
  }
}

// --------------------------------------------------------------- core shapes

/**
 * Actor-focus clause: verb + pronoun (+ ng object) (+ sa place) (+ time).
 * This is the workhorse — most everyday and conversational focuses are this
 * with a different aspect, a negator, or an adverb bolted on.
 */
export function clause(rng, ctx, { aspect, pron, verb, obj = null, place = null, time = null, negate = false }) {
  const habitual = Boolean(time && time.habitual);
  const tlParts = [];
  const enParts = [];

  if (time && time.pos === "initial") {
    // "Palagi akong kumakain ng isda." — the fronted adverb links to the pronoun
    tlParts.push(time.tl, ligate(pron.ang), negate ? "hindi" : null, vf(verb, aspect));
    enParts.push(pron.en);
    enParts.push(time.en);
    enParts.push(negate ? enNegVerb(verb, aspect, pron, { habitual }).main : enVerb(verb, aspect, pron, { habitual }));
  } else if (negate) {
    tlParts.push("hindi", pron.ang, vf(verb, aspect));
    enParts.push(pron.en, enNegVerb(verb, aspect, pron, { habitual }).main);
  } else {
    tlParts.push(vf(verb, aspect), pron.ang);
    enParts.push(pron.en, enVerb(verb, aspect, pron, { habitual }));
  }

  if (obj) {
    tlParts.push("ng", obj.tl);
    enParts.push(enNP(obj));
  }
  if (place) {
    tlParts.push("sa", place.tl);
    const prep = prepFor(verb, place);
    enParts.push(prep ? `${prep} ${place.en}` : `the ${place.en}`);
  }
  if (time && time.pos === "final") {
    tlParts.push(time.tl);
    enParts.push(time.en);
  }

  const accept = [];
  if (negate) {
    const alt = enNegVerb(verb, aspect, pron, { habitual }).alt;
    const main = enNegVerb(verb, aspect, pron, { habitual }).main;
    accept.push(enSentence(enParts.map((p) => (p === main ? alt : p))));
  }

  return S({
    tl: tlSentence(tlParts),
    en: enSentence(enParts),
    accept,
    key: { word: vf(verb, aspect), options: aspectOptions(verb, aspect) },
    gloss: [
      { tl: vf(verb, aspect), en: negate ? verb.en.base : enVerb(verb, aspect, pron, { habitual }).replace(/^(am|is|are) /, "") },
      ...(obj ? [{ tl: obj.tl, en: obj.en }] : []),
      ...(place ? [{ tl: place.tl, en: place.en }] : []),
      ...(time ? [{ tl: time.tl, en: time.en }] : []),
    ],
  });
}

/**
 * Yes/no question: "ba" sits right after the pronoun, and English switches to
 * do/be/will support ("Kumain ka ba ng kanin?" -> "Did you eat rice?").
 */
export function baQuestion(rng, ctx, { aspect, pron, verb, obj = null, place = null, time = null }) {
  const habitual = Boolean(time && time.habitual);
  const tlParts = [vf(verb, aspect), pron.ang, "ba"];
  const aux =
    aspect === "comp"
      ? "did"
      : aspect === "cont"
        ? "will"
        : habitual
          ? pron.third
            ? "does"
            : "do"
          : pron.be;
  const enParts = [aux, pron.en, habitual || aspect !== "prog" ? verb.en.base : verb.en.ing];

  if (obj) {
    tlParts.push("ng", obj.tl);
    enParts.push(enNP(obj));
  }
  if (place) {
    tlParts.push("sa", place.tl);
    const prep = prepFor(verb, place);
    enParts.push(prep ? `${prep} ${place.en}` : `the ${place.en}`);
  }
  if (time) {
    tlParts.push(time.tl);
    enParts.push(time.en);
  }

  return S({
    tl: tlSentence(tlParts, { q: true }),
    en: enSentence(enParts, { q: true }),
    q: true,
    key: { word: "ba", options: ["ba", "na", "pa"] },
    gloss: [
      { tl: vf(verb, aspect), en: verb.en.base },
      ...(obj ? [{ tl: obj.tl, en: obj.en }] : []),
    ],
  });
}

function cap1(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Masarap ang adobo." — adjective predicate */
export function adjPredicate(rng, ctx, { adj, noun, negate = false, def = true }) {
  return S({
    tl: tlSentence([negate ? "hindi" : null, adj.tl, "ang", noun.tl]),
    en: enSentence([enNP(noun, { def }), negate ? "is not" : "is", adj.en]),
    accept: negate ? [enSentence([enNP(noun, { def }), "isn't", adj.en])] : [],
    key: { word: adj.tl, options: options(adj.tl, ctx.adjPool(noun.cat).map((x) => x.tl)) },
    gloss: [
      { tl: adj.tl, en: adj.en },
      { tl: noun.tl, en: noun.en },
    ],
  });
}

/** "May kotse ako." / "Wala akong kotse." */
export function possession(rng, ctx, { noun, pron, negate = false }) {
  const tl = negate
    ? tlSentence(["wala", ligate(pron.ang), noun.tl])
    : tlSentence(["may", noun.tl, pron.ang]);
  const have = pron.third ? "has" : "have";
  const en = negate
    ? enSentence([pron.en, pron.third ? "doesn't have" : "don't have", noun.mass ? noun.en : `a ${noun.en}`])
    : enSentence([pron.en, have, enNP(noun)]);
  return S({
    tl,
    en,
    accept: negate
      ? [enSentence([pron.en, pron.third ? "does not have" : "do not have", noun.mass ? noun.en : `a ${noun.en}`]),
         enSentence([pron.en, pron.third ? "has no" : "have no", noun.en])]
      : [],
    key: { word: noun.tl, options: options(noun.tl, ctx.themePool().map((x) => x.tl)) },
    gloss: [{ tl: noun.tl, en: noun.en }],
  });
}

/** "Nasa palengke ako." / "Wala ako sa palengke." */
export function located(rng, ctx, { place, pron = null, noun = null, negate = false }) {
  const subjTl = pron ? pron.ang : `ang ${noun.tl}`;
  const subjEn = pron ? pron.en : enNP(noun, { def: true });
  const be = pron ? pron.be : "is";
  return S({
    tl: negate
      ? tlSentence(["wala", subjTl, "sa", place.tl])
      : tlSentence(["nasa", place.tl, subjTl]),
    en: enSentence([subjEn, negate ? `${be} not` : be, atThe(place)]),
    accept: negate ? [enSentence([subjEn, be === "am" ? "am not" : `${be}n't`, atThe(place)])] : [],
    key: { word: place.tl, options: options(place.tl, ctx.placePool().map((x) => x.tl)) },
    gloss: [{ tl: place.tl, en: place.en }],
  });
}

/** "Gusto ko ng kape." / "Ayaw niya ng kape." */
export function wants(rng, ctx, { noun, pron, verbWord = "gusto" }) {
  const en = verbWord === "gusto" ? (pron.third ? "wants" : "want") : pron.third ? "doesn't like" : "don't like";
  return S({
    tl: tlSentence([verbWord, pron.ng, "ng", noun.tl]),
    en: enSentence([pron.en, en, enNP(noun)]),
    accept:
      verbWord === "gusto"
        ? [enSentence([pron.en, pron.third ? "likes" : "like", enNP(noun)])]
        : [enSentence([pron.en, pron.third ? "does not like" : "do not like", enNP(noun)])],
    key: { word: noun.tl, options: options(noun.tl, ctx.themePool().map((x) => x.tl)) },
    gloss: [{ tl: noun.tl, en: noun.en }],
  });
}

/** "Gusto kong kumain ng isda." — linker on the ng-pronoun before a verb */
export function wantsToVerb(rng, ctx, { pron, verb, obj = null, place = null, verbWord = "gusto" }) {
  const enHead = verbWord === "gusto" ? (pron.third ? "wants" : "want") : pron.third ? "doesn't want" : "don't want";
  const tlParts = [verbWord, ligate(pron.ng), vf(verb, "inf")];
  const enParts = [pron.en, enHead, "to", verb.en.base];
  if (obj) {
    tlParts.push("ng", obj.tl);
    enParts.push(enNP(obj));
  }
  if (place) {
    tlParts.push("sa", place.tl);
    const prep = prepFor(verb, place);
    enParts.push(prep ? `${prep} ${place.en}` : `the ${place.en}`);
  }
  return S({
    tl: tlSentence(tlParts),
    en: enSentence(enParts),
    key: { word: vf(verb, "inf"), options: aspectOptions(verb, "inf") },
    gloss: [
      { tl: vf(verb, "inf"), en: `to ${verb.en.base}` },
      ...(obj ? [{ tl: obj.tl, en: obj.en }] : []),
    ],
  });
}

/** "Kinain ko ang isda." — object focus puts the object in the spotlight */
export function objectFocus(rng, ctx, { verb, pron, obj, aspect = "comp" }) {
  const form = verb.o[aspect];
  return S({
    tl: tlSentence([form, pron.ng, "ang", obj.tl]),
    en: enSentence([pron.en, enVerb(verb, aspect, pron), enNP(obj, { def: true })]),
    key: { word: form, options: options(form, ["comp", "prog", "cont", "inf"].filter((x) => x !== aspect).map((x) => verb.o[x]).filter(Boolean)) },
    gloss: [
      { tl: form, en: enVerb(verb, aspect, pron) },
      { tl: obj.tl, en: obj.en },
    ],
  });
}

/** "Kumain ka ng gulay." / "Huwag kang kumain ng matamis." */
export function command(rng, ctx, { verb, obj = null, place = null, negate = false, polite = false }) {
  const tlParts = negate ? ["huwag", "kang", vf(verb, "inf")] : [vf(verb, "imp"), "ka", polite ? "po" : null];
  const enParts = negate ? ["don't", verb.en.base] : [verb.en.base];
  if (obj) {
    tlParts.push("ng", obj.tl);
    enParts.push(enNP(obj));
  }
  if (place) {
    tlParts.push("sa", place.tl);
    const prep = prepFor(verb, place);
    enParts.push(prep ? `${prep} ${place.en}` : `the ${place.en}`);
  }
  if (polite) enParts.push("please");
  return S({
    tl: tlSentence(tlParts, { bang: !negate }),
    en: enSentence(enParts, { bang: !negate }),
    accept: polite ? [enSentence(["please", ...enParts.filter((x) => x !== "please")], { bang: true })] : [],
    key: { word: negate ? vf(verb, "inf") : vf(verb, "imp"), options: aspectOptions(verb, negate ? "inf" : "imp") },
    gloss: [{ tl: vf(verb, "imp"), en: verb.en.base }, ...(obj ? [{ tl: obj.tl, en: obj.en }] : [])],
  });
}

/** "Mas malaki ang bahay kaysa sa kotse." */
export function comparison(rng, ctx, { adj, a: nounA, b: nounB, mode = "mas" }) {
  if (mode === "pinaka") {
    return S({
      tl: tlSentence(["ang", nounA.tl, "ang", `pinaka${adj.tl}`]),
      en: enSentence(["the", nounA.en, "is the", superlative(adj.en)]),
      key: { word: `pinaka${adj.tl}`, options: options(`pinaka${adj.tl}`, ctx.adjPool(nounA.cat).map((x) => `pinaka${x.tl}`)) },
      gloss: [{ tl: `pinaka${adj.tl}`, en: `the ${superlative(adj.en)}` }],
    });
  }
  if (mode === "kasing") {
    return S({
      tl: tlSentence([`kasing${adj.tl}`, "ng", nounB.tl, "ang", nounA.tl]),
      en: enSentence(["the", nounA.en, "is as", adj.en, "as the", nounB.en]),
      key: { word: `kasing${adj.tl}`, options: options(`kasing${adj.tl}`, ctx.adjPool(nounA.cat).map((x) => `kasing${x.tl}`)) },
      gloss: [{ tl: `kasing${adj.tl}`, en: `as ${adj.en} as` }],
    });
  }
  return S({
    tl: tlSentence(["mas", adj.tl, "ang", nounA.tl, "kaysa", "sa", nounB.tl]),
    en: enSentence(["the", nounA.en, "is more", adj.en, "than the", nounB.en]),
    accept: [enSentence(["the", nounA.en, "is", comparative(adj.en), "than the", nounB.en])],
    key: { word: "mas", options: ["mas", "kaysa", "pinaka"] },
    gloss: [
      { tl: `mas ${adj.tl}`, en: `more ${adj.en}` },
      { tl: nounA.tl, en: nounA.en },
    ],
  });
}

/** English comparative/superlative for the short adjectives the lexicon uses */
export function comparative(en) {
  if (/[^aeiou]y$/.test(en)) return `${en.slice(0, -1)}ier`;
  if (/^(big|hot|thin|sad|wet|fat)$/.test(en)) return `${en}${en.slice(-1)}er`;
  if (en.split(" ").length > 1 || en.length > 7) return `more ${en}`;
  if (/e$/.test(en)) return `${en}r`;
  return `${en}er`;
}
export function superlative(en) {
  if (/[^aeiou]y$/.test(en)) return `${en.slice(0, -1)}iest`;
  if (/^(big|hot|thin|sad|wet|fat)$/.test(en)) return `${en}${en.slice(-1)}est`;
  if (en.split(" ").length > 1 || en.length > 7) return `most ${en}`;
  if (/e$/.test(en)) return `${en}st`;
  return `${en}est`;
}

/** "Kaya kong magluto ng adobo." / "Marunong siyang sumayaw." */
export function ability(rng, ctx, { pron, verb, obj = null, mode = "kaya" }) {
  const heads = {
    kaya: { tl: "kaya", en: pron.third ? "can" : "can", pron: "ng" },
    marunong: { tl: "marunong", en: pron.third ? "knows how" : "know how", pron: "ang" },
    puwede: { tl: "puwede", en: pron.third ? "may" : "may", pron: "ang" },
  };
  const h = heads[mode];
  const pronForm = h.pron === "ng" ? pron.ng : pron.ang;
  const tlParts = [h.tl, ligate(pronForm), vf(verb, "inf")];
  const enParts = [pron.en, h.en, mode === "marunong" ? "to" : null, verb.en.base];
  if (obj) {
    tlParts.push("ng", obj.tl);
    enParts.push(enNP(obj));
  }
  return S({
    tl: tlSentence(tlParts),
    en: enSentence(enParts),
    key: { word: h.tl, options: options(h.tl, ["kaya", "marunong", "puwede", "gusto"]) },
    gloss: [{ tl: `${h.tl} ${ligate(pronForm)}`, en: `${pron.en} ${h.en}` }],
  });
}

/** two clauses joined by a connector — the mastery workhorse */
export function joinClauses(first, second, connector) {
  const tl =
    connector.tlPos === "initial"
      ? `${connector.tl} ${lower1(bare(first.tl))}, ${lower1(bare(second.tl))}.`
      : `${bare(first.tl)} ${connector.tl} ${lower1(bare(second.tl))}.`;
  const en =
    connector.enPos === "initial"
      ? `${cap1(connector.en)} ${lower1(bare(first.en))}, ${lower1(bare(second.en))}.`
      : `${bare(first.en)} ${connector.en} ${lower1(bare(second.en))}.`;
  return S({
    tl: cap1(tl),
    en: cap1(en),
    accept: [],
    key: { word: connector.tl, options: connector.options },
    gloss: [{ tl: connector.tl, en: connector.en }, ...first.gloss.slice(0, 1), ...second.gloss.slice(0, 1)],
  });
}

export function lower1(s) {
  return /^[A-Z][a-z]/.test(s) && !/^(I|Ana|Ben|Maria|Jose|Lito|Rosa|Nena|Carlo|Divina|Jun|Tess|Rico|Mila|Dado|Luz|Ramon|Pasko|Diyos|Lunes|Martes|Miyerkules|Huwebes|Biyernes|Sabado|Linggo)\b/.test(s)
    ? s.charAt(0).toLowerCase() + s.slice(1)
    : s;
}

export { cap1 };

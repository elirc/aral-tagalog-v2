/**
 * Everyday-tier focuses: the verb machine. Aspect (done / happening / not yet
 * happened), questions, negation, the little particles, and motion verbs with
 * places. Every maker here funnels through `clause` so the English gloss tracks
 * the Tagalog aspect exactly.
 */

import { atThe, enNP, enSentence, ligate, tlSentence, vf } from "./grammar.mjs";
import { S, options, aspectOptions, clause, baQuestion, prepFor, lower1 } from "./makers.mjs";

/** din after a consonant, rin after a vowel */
function too(prev) {
  return /[aeiouwy]$/i.test(prev) ? "rin" : "din";
}

const aspectFocus = (id, aspect, title, tip, lessonTitles) => ({
  id,
  title,
  tip,
  lessonTitles,
  makers: [
    {
      needs: [],
      make: (rng, ctx) => {
        const act = ctx.action();
        if (!act) return null;
        return clause(rng, ctx, { aspect, pron: ctx.pron(), ...act });
      },
    },
    {
      needs: [],
      make: (rng, ctx) => {
        const act = ctx.action();
        if (!act) return null;
        return clause(rng, ctx, { aspect, pron: ctx.pron(), ...act, time: ctx.time(aspect) });
      },
    },
    {
      needs: [],
      make: (rng, ctx) => {
        const act = ctx.action({ wantPlace: true });
        if (!act) return null;
        return clause(rng, ctx, { aspect, pron: ctx.pron(), ...act });
      },
    },
    {
      needs: [],
      make: (rng, ctx) => {
        const act = ctx.action();
        if (!act) return null;
        const name = ctx.name();
        const st = clause(rng, ctx, { aspect, pron: ctx.pronById("siya"), ...act });
        // swap the pronoun for a named subject: "Kumain si Ana ng adobo."
        const tl = st.tl.replace(/\bsiya\b/, `si ${name}`);
        const en = st.en.replace(/^He\b/, name).replace(/^She\b/, name);
        return S({ tl, en, key: st.key, gloss: st.gloss });
      },
    },
  ],
  qa: (rng, ctx) => {
    const act = ctx.action();
    if (!act) return null;
    return {
      q: baQuestion(rng, ctx, { aspect, pron: ctx.pronById("ikaw"), ...act }),
      a: clause(rng, ctx, { aspect, pron: ctx.pronById("ako"), ...act }),
    };
  },
});

export const EVERYDAY_FOCUSES = [
  aspectFocus(
    "past-actions",
    "comp",
    "What already happened",
    "The completed aspect says the action is done. UM verbs take -um- before " +
      "the first vowel (kain -> kumain) and MAG verbs swap mag- for nag- " +
      "(magluto -> nagluto). No extra word for did — the verb carries it.",
    ["Done and dusted", "Yesterday", "Where it happened", "Someone else did it"],
  ),
  aspectFocus(
    "happening-now",
    "prog",
    "What is happening now",
    "Repeat the first syllable of the root and the action is in progress: " +
      "kumain -> kumakain (is eating), nagluto -> nagluluto (is cooking). The " +
      "same form covers habits — kumakain ako araw-araw = I eat every day.",
    ["Right now", "In progress", "Out and about", "Watching it happen"],
  ),
  aspectFocus(
    "plans-ahead",
    "cont",
    "What has not happened yet",
    "The contemplated aspect covers will and going to. UM verbs drop the -um- " +
      "and reduplicate (kakain), MAG verbs keep mag- and reduplicate " +
      "(magluluto). Pair it with bukas or mamaya.",
    ["Tomorrow", "Later today", "Making plans", "Not yet, but soon"],
  ),

  {
    id: "yes-no",
    title: "Yes-or-no questions",
    tip:
      "Ba turns any statement into a question. It sits right after the first " +
      "phrase — usually straight after the pronoun: Kumain ka ba? Answer with " +
      "oo/hindi, then repeat the verb.",
    lessonTitles: ["…ba?", "Answering yes", "Answering no", "Ask and answer"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return baQuestion(rng, ctx, { aspect: rng.pick(["comp", "prog", "cont"]), pron: ctx.pron(), ...act });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const aspect = rng.pick(["comp", "prog"]);
          const st = clause(rng, ctx, { aspect, pron: ctx.pronById("ako"), ...act });
          return S({
            tl: `Oo, ${lower1(st.tl)}`,
            en: `Yes, ${lower1(st.en)}`,
            key: { word: "Oo", options: ["Oo", "Hindi", "Wala"] },
            gloss: st.gloss,
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const aspect = rng.pick(["comp", "prog"]);
          const st = clause(rng, ctx, { aspect, pron: ctx.pronById("ako"), ...act, negate: true });
          return S({
            tl: `Hindi, ${lower1(st.tl)}`,
            en: `No, ${lower1(st.en)}`,
            accept: st.accept.map((a) => `No, ${lower1(a)}`),
            key: { word: "Hindi", options: ["Hindi", "Oo", "Wala"] },
            gloss: st.gloss,
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return baQuestion(rng, ctx, { aspect: "cont", pron: ctx.pronById("ikaw"), ...act, time: ctx.time("cont") });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: baQuestion(rng, ctx, { aspect: "comp", pron: ctx.pronById("ikaw"), ...act }),
        a: clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...act }),
      };
    },
  },

  {
    id: "wh-questions",
    title: "Asking with question words",
    tip:
      "Saan (where), kailan (when), bakit (why), paano (how) all come first, " +
      "and the pronoun hops in right behind them: Saan ka pumunta? For what-are-" +
      "you-doing, Tagalog uses Ano ang ginagawa mo?",
    lessonTitles: ["Saan?", "Kailan?", "Bakit?", "Ano ang ginagawa mo?"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act || !act.place) return null;
          const aspect = rng.pick(["comp", "cont"]);
          const verb = act.verb;
          const aux = aspect === "comp" ? "did" : "will";
          return S({
            tl: tlSentence(["saan", "ka", vf(verb, aspect)], { q: true }),
            en: enSentence(["where", aux, "you", verb.en.base], { q: true }),
            q: true,
            key: { word: "saan", options: ["saan", "kailan", "bakit"] },
            gloss: [{ tl: "saan", en: "where" }, { tl: vf(verb, aspect), en: verb.en.base }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["kailan", "ka", vf(act.verb, "cont")], { q: true }),
            en: enSentence(["when will you", act.verb.en.base], { q: true }),
            q: true,
            key: { word: "kailan", options: ["kailan", "saan", "sino"] },
            gloss: [{ tl: "kailan", en: "when" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["bakit", "ka", vf(act.verb, "comp")], { q: true }),
            en: enSentence(["why did you", act.verb.en.base], { q: true }),
            q: true,
            key: { word: "bakit", options: ["bakit", "paano", "kailan"] },
            gloss: [{ tl: "bakit", en: "why" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ needObj: true });
          if (!act || !act.obj) return null;
          return S({
            tl: tlSentence(["sino", "ang", vf(act.verb, "comp"), "ng", act.obj.tl], { q: true }),
            en: enSentence(["who", act.verb.en.past, enNP(act.obj)], { q: true }),
            q: true,
            key: { word: "sino", options: ["sino", "ano", "saan"] },
            gloss: [{ tl: "sino", en: "who" }, { tl: act.obj.tl, en: act.obj.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action({ wantPlace: true });
      if (!act || !act.place) return null;
      return {
        q: S({
          tl: tlSentence(["saan", "ka", vf(act.verb, "comp")], { q: true }),
          en: enSentence(["where did you", act.verb.en.base], { q: true }),
          q: true,
          key: { word: "saan", options: ["saan", "kailan", "bakit"] },
        }),
        a: clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...act }),
      };
    },
  },

  {
    id: "negation",
    title: "Saying no",
    tip:
      "Hindi negates verbs and adjectives and pulls the pronoun in front of the " +
      "verb: Hindi ako kumain. Wala negates having and being somewhere: Wala " +
      "akong pera, wala ako sa bahay. Hindi pa = not yet.",
    lessonTitles: ["Hindi + verb", "Hindi pa", "Wala", "Neither one"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return clause(rng, ctx, { aspect: rng.pick(["comp", "prog"]), pron: ctx.pron(), ...act, negate: true });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["hindi", "pa", pron.ang, vf(act.verb, "prog"), act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, pron.third ? "has not" : "have not", act.verb.en.past === act.verb.en.base ? act.verb.en.base : pastPart(act.verb), "yet", act.obj ? enNP(act.obj) : null]),
            accept: [
              enSentence([pron.en, pron.third ? "hasn't" : "haven't", pastPart(act.verb), "yet", act.obj ? enNP(act.obj) : null]),
            ],
            key: { word: "pa", options: ["pa", "na", "ba"] },
            gloss: [{ tl: "hindi pa", en: "not yet" }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink"]);
          if (!noun) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["wala", ligate(pron.ang), noun.tl]),
            en: enSentence([pron.en, pron.third ? "has no" : "have no", noun.en]),
            accept: [enSentence([pron.en, pron.third ? "doesn't have" : "don't have", noun.mass ? noun.en : `a ${noun.en}`])],
            key: { word: "wala", options: ["wala", "hindi", "may"] },
            gloss: [{ tl: "wala", en: "none / not there" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["wala", pron.ang, "sa", place.tl]),
            en: enSentence([pron.en, `${pron.be} not`, atThe(place)]),
            accept: [enSentence([pron.en, pron.be === "am" ? "am not" : `${pron.be}n't`, atThe(place)])],
            key: { word: "wala", options: ["wala", "hindi", "nasa"] },
            gloss: [{ tl: place.tl, en: place.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: baQuestion(rng, ctx, { aspect: "comp", pron: ctx.pronById("ikaw"), ...act }),
        a: clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...act, negate: true }),
      };
    },
  },

  {
    id: "particles",
    title: "The little words",
    tip:
      "Na means already, pa means still or yet, lang means only, and din/rin " +
      "means too (rin after a vowel, din after a consonant). They cling to the " +
      "word they follow: Kumain na ako. Kape lang. Ako rin.",
    lessonTitles: ["Na and pa", "Lang", "Din and rin", "Stack them up"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence([vf(act.verb, "comp"), "na", pron.ang, act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, "already", act.verb.en.past, act.obj ? enNP(act.obj) : null]),
            key: { word: "na", options: ["na", "pa", "lang"] },
            gloss: [{ tl: "na", en: "already" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence([vf(act.verb, "prog"), "pa", pron.ang, act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, `${pron.be} still`, act.verb.en.ing, act.obj ? enNP(act.obj) : null]),
            key: { word: "pa", options: ["pa", "na", "din"] },
            gloss: [{ tl: "pa", en: "still" }],
          });
        },
      },
      {
        needs: ["food", "drink", "thing"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["food", "drink", "thing"]);
          if (!noun) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence([noun.tl, "lang", "ang", "gusto", pron.ng]),
            en: enSentence([pron.en, pron.third ? "only wants" : "only want", enNP(noun)]),
            key: { word: "lang", options: ["lang", "din", "na"] },
            gloss: [{ tl: "lang", en: "only / just" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          const verbForm = vf(act.verb, "comp");
          return S({
            tl: tlSentence([verbForm, too(verbForm), pron.ang, act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, "also", act.verb.en.past, act.obj ? enNP(act.obj) : null]),
            accept: [enSentence([pron.en, act.verb.en.past, act.obj ? enNP(act.obj) : null, "too"])],
            key: { word: too(verbForm), options: [too(verbForm), "na", "lang"] },
            gloss: [{ tl: too(verbForm), en: "also / too" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      const pron = ctx.pronById("ako");
      return {
        q: S({
          tl: tlSentence([vf(act.verb, "comp"), "ka", "na", "ba"], { q: true }),
          en: enSentence(["have you", pastPart(act.verb), "already"], { q: true }),
          q: true,
          key: { word: "na", options: ["na", "pa", "lang"] },
        }),
        a: S({
          tl: tlSentence(["hindi", "pa", pron.ang]),
          en: "Not yet.",
          key: { word: "pa", options: ["pa", "na", "din"] },
        }),
      };
    },
  },

  {
    id: "coming-going",
    title: "Coming and going",
    tip:
      "Pumunta sa = went to, galing sa = came from, umuwi = went home. The " +
      "vehicle rides on sakay: Sumakay ako ng dyip (I rode a jeepney).",
    lessonTitles: ["Pumunta sa", "Galing sa", "Umuwi", "Getting around"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          const pron = ctx.pron();
          const verb = ctx.verbById("punta");
          const aspect = rng.pick(["comp", "prog", "cont"]);
          return clause(rng, ctx, { aspect, pron, verb, place, time: rng.chance(0.5) ? ctx.time(aspect) : null });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["galing", pron.ang, "sa", place.tl]),
            en: enSentence([pron.en, pron.third ? "came" : "came", "from the", place.en]),
            key: { word: "galing", options: ["galing", "nasa", "punta"] },
            gloss: [{ tl: "galing sa", en: "came from" }, { tl: place.tl, en: place.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const pron = ctx.pron();
          const verb = ctx.verbById("uwi");
          const aspect = rng.pick(["comp", "cont"]);
          return clause(rng, ctx, { aspect, pron, verb, time: ctx.time(aspect) });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const pron = ctx.pron();
          const ride = ctx.rideNoun();
          const verb = ctx.verbById("sakay");
          const aspect = rng.pick(["comp", "cont"]);
          return S({
            tl: tlSentence([vf(verb, aspect), pron.ang, "ng", ride.tl]),
            en: enSentence([pron.en, aspect === "comp" ? "rode" : "will ride", enNP(ride)]),
            key: { word: vf(verb, aspect), options: aspectOptions(verb, aspect) },
            gloss: [{ tl: ride.tl, en: ride.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const place = ctx.place();
      return {
        q: S({
          tl: "Saan ka pupunta?",
          en: "Where are you going?",
          q: true,
          key: { word: "Saan", options: ["Saan", "Kailan", "Bakit"] },
        }),
        a: clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("ako"), verb: ctx.verbById("punta"), place }),
      };
    },
  },

  {
    id: "frequency",
    title: "How often",
    tip:
      "Frequency words use the same form as happening-now. Araw-araw and tuwing " +
      "Lunes sit at the end; palagi and madalas come first and take the linker " +
      "on the pronoun: Palagi akong kumakain dito.",
    lessonTitles: ["Araw-araw", "Tuwing…", "Palagi and madalas", "Routines"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return clause(rng, ctx, { aspect: "prog", pron: ctx.pron(), ...act, time: ctx.habitTime("final") });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return clause(rng, ctx, { aspect: "prog", pron: ctx.pron(), ...act, time: ctx.habitTime("initial") });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          return clause(rng, ctx, { aspect: "prog", pron: ctx.pron(), ...act, time: ctx.habitTime("final") });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["hindi", pron.ang, vf(act.verb, "prog"), act.obj ? `ng ${act.obj.tl}` : null, "kailanman"]),
            en: enSentence([pron.en, "never", act.verb.en.base === "go" ? "go" : act.verb.en.base, act.obj ? enNP(act.obj) : null]),
            key: { word: "kailanman", options: ["kailanman", "palagi", "minsan"] },
            gloss: [{ tl: "hindi kailanman", en: "never" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence(["gaano", "kadalas", "ka", vf(act.verb, "prog")], { q: true }),
          en: enSentence(["how often do you", act.verb.en.base], { q: true }),
          q: true,
          key: { word: "kadalas", options: ["kadalas", "kalayo", "kalaki"] },
        }),
        a: clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("ako"), ...act, time: ctx.habitTime("final") }),
      };
    },
  },

  {
    id: "with-whom",
    title: "With and for people",
    tip:
      "Kasama = together with, para sa/kay = for. People take kay after a " +
      "preposition and si as a subject: Kasama ko si Ana. Para kay Ben ito.",
    lessonTitles: ["Kasama", "Para kay…", "Doing it together", "Who came along"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const name = ctx.name();
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["kasama", pron.ng, "si", name]),
            en: enSentence([name, "is with", pron.enObj]),
            key: { word: "kasama", options: ["kasama", "para", "galing"] },
            gloss: [{ tl: "kasama", en: "together with" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act || !act.place) return null;
          const name = ctx.name();
          const st = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...act });
          return S({
            tl: `${st.tl.replace(/\.$/, "")} kasama si ${name}.`,
            en: `${st.en.replace(/\.$/, "")} with ${name}.`,
            key: { word: "kasama", options: ["kasama", "galing", "para"] },
            gloss: [...st.gloss, { tl: "kasama", en: "with" }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink"]);
          if (!noun) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["para", "kay", name, "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is for", name]),
            key: { word: "kay", options: ["kay", "si", "ni"] },
            gloss: [{ tl: `para kay ${name}`, en: `for ${name}` }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink"]);
          if (!noun) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["para", "sa", pron.sa, "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is for", pron.enObj]),
            key: { word: "para", options: ["para", "kasama", "galing"] },
            gloss: [{ tl: `para sa ${pron.sa}`, en: `for ${pron.enObj}` }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const name = ctx.name();
      return {
        q: S({
          tl: "Sino ang kasama mo?",
          en: "Who is with you?",
          q: true,
          key: { word: "kasama", options: ["kasama", "para", "galing"] },
        }),
        a: S({
          tl: tlSentence(["kasama", "ko", "si", name]),
          en: enSentence([name, "is with me"]),
          key: { word: "si", options: ["si", "ni", "kay"] },
        }),
      };
    },
  },
].map((f) => ({ ...f, tier: "everyday" }));

/** crude but adequate past participle for the have-not-yet frame */
function pastPart(verb) {
  const { base, past } = verb.en;
  const irregular = {
    eat: "eaten", drink: "drunk", go: "gone", buy: "bought", see: "seen", write: "written",
    read: "read", sing: "sung", run: "run", take: "taken", get: "gotten", give: "given",
    make: "made", sleep: "slept", swim: "swum", ride: "ridden", wake: "woken", choose: "chosen",
    "wake up": "woken up", "go home": "gone home", "get off": "gotten off", "go in": "gone in",
    "go out": "gone out", "come back": "come back", "lie down": "lain down", "get dressed": "gotten dressed",
    "get sick": "gotten sick", "throw away": "thrown away", "pick up": "picked up",
  };
  return irregular[base] ?? past;
}

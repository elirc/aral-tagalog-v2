/**
 * Conversational-tier focuses: linkers, ability, commands, comparison, object
 * focus, and the connectives that let two clauses share one sentence.
 */

import { atThe, bare, enNP, enSentence, ligate, modify, tlSentence, vf } from "./grammar.mjs";
import {
  S,
  options,
  aspectOptions,
  clause,
  ability,
  command,
  comparison,
  comparative,
  superlative,
  objectFocus,
  wantsToVerb,
  joinClauses,
  lower1,
} from "./makers.mjs";

export const CONVERSATIONAL_FOCUSES = [
  {
    id: "linked-verbs",
    title: "Wanting to do things",
    tip:
      "Two verbs in a row need a linker, and it lands on the pronoun: Gusto ko " +
      "+ kumain becomes Gusto kong kumain. Same shape for ayaw, kailangan and " +
      "balak.",
    lessonTitles: ["Gusto kong…", "Ayaw kong…", "Kailangan ko", "Chaining verbs"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return wantsToVerb(rng, ctx, { pron: ctx.pron(), ...act });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return wantsToVerb(rng, ctx, { pron: ctx.pron(), ...act, verbWord: "ayaw" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["kailangan", ligate(pron.ng), vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null, act.place ? `sa ${act.place.tl}` : null]),
            en: enSentence([pron.en, pron.third ? "needs to" : "need to", act.verb.en.base, act.obj ? enNP(act.obj) : null, act.place ? atThe(act.place) : null]),
            key: { word: "kailangan", options: ["kailangan", "gusto", "ayaw"] },
            gloss: [{ tl: "kailangan", en: "need" }, ...(act.obj ? [{ tl: act.obj.tl, en: act.obj.en }] : [])],
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
            tl: tlSentence(["gusto", ligate(pron.ng), "matutong", vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, pron.third ? "wants to learn to" : "want to learn to", act.verb.en.base, act.obj ? enNP(act.obj) : null]),
            key: { word: "matutong", options: ["matutong", "kayang", "ayaw"] },
            gloss: [{ tl: "matutong", en: "to learn to" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence(["ano", "ang", "gusto", "mong", "gawin"], { q: true }),
          en: "What do you want to do?",
          q: true,
          key: { word: "gusto", options: ["gusto", "ayaw", "kaya"] },
        }),
        a: wantsToVerb(rng, ctx, { pron: ctx.pronById("ako"), ...act }),
      };
    },
  },

  {
    id: "ability",
    title: "Can, know how, may",
    tip:
      "Kaya = physically able, marunong = knows how (a learned skill), puwede/" +
      "maaari = allowed. Kaya and marunong take the linker: Kaya kong tumakbo, " +
      "Marunong akong magluto.",
    lessonTitles: ["Kaya ko", "Marunong ako", "Puwede ba?", "Can and may"],
    makers: [
      { needs: [], make: (rng, ctx) => { const a = ctx.action(); return a && ability(rng, ctx, { pron: ctx.pron(), ...a, mode: "kaya" }); } },
      { needs: [], make: (rng, ctx) => { const a = ctx.action(); return a && ability(rng, ctx, { pron: ctx.pron(), ...a, mode: "marunong" }); } },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["puwede", "ba", ligate(pron.ang), vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null], { q: true }),
            en: enSentence(["may", pron.en, act.verb.en.base, act.obj ? enNP(act.obj) : null], { q: true }),
            q: true,
            accept: [enSentence(["can", pron.en, act.verb.en.base, act.obj ? enNP(act.obj) : null], { q: true })],
            key: { word: "puwede", options: ["puwede", "kaya", "marunong"] },
            gloss: [{ tl: "puwede ba", en: "may I / is it allowed" }],
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
            tl: tlSentence(["hindi", pron.ng, "kayang", vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([pron.en, "cannot", act.verb.en.base, act.obj ? enNP(act.obj) : null]),
            accept: [enSentence([pron.en, "can't", act.verb.en.base, act.obj ? enNP(act.obj) : null])],
            key: { word: "kayang", options: ["kayang", "gustong", "ayaw"] },
            gloss: [{ tl: "hindi kaya", en: "cannot" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence(["marunong", "ka", "bang", vf(act.verb, "inf")], { q: true }),
          en: enSentence(["do you know how to", act.verb.en.base], { q: true }),
          q: true,
          key: { word: "marunong", options: ["marunong", "kaya", "gusto"] },
        }),
        a: ability(rng, ctx, { pron: ctx.pronById("ako"), ...act, mode: "marunong" }),
      };
    },
  },

  {
    id: "commands",
    title: "Telling someone what to do",
    tip:
      "The infinitive doubles as the command: Kumain ka! For don't, huwag takes " +
      "the linker on the pronoun and the verb stays in the infinitive: Huwag " +
      "kang kumain. Add po to soften it.",
    lessonTitles: ["Do it", "Huwag!", "Polite orders", "Instructions"],
    makers: [
      { needs: [], make: (rng, ctx) => { const a = ctx.action(); return a && command(rng, ctx, { ...a }); } },
      { needs: [], make: (rng, ctx) => { const a = ctx.action(); return a && command(rng, ctx, { ...a, negate: true }); } },
      { needs: [], make: (rng, ctx) => { const a = ctx.action({ wantPlace: true }); return a && command(rng, ctx, { ...a, polite: true }); } },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["tayo", "na", ",", vf(act.verb, "inf"), "na", "tayo"]),
            en: enSentence(["come on, let us", act.verb.en.base, "now"]),
            accept: [enSentence(["come on, let's", act.verb.en.base, "now"])],
            key: { word: "tayo", options: ["tayo", "kayo", "sila"] },
            gloss: [{ tl: "tayo na", en: "let us go / come on" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: command(rng, ctx, { ...act, polite: true }),
        a: S({
          tl: "Sige po, gagawin ko.",
          en: "All right, I will do it.",
          key: { word: "Sige", options: ["Sige", "Huwag", "Hindi"] },
        }),
      };
    },
  },

  {
    id: "comparison",
    title: "More, less, most",
    tip:
      "Mas + adjective + kaysa sa = more than. Pinaka- prefixed to the adjective " +
      "is the superlative (pinakamalaki = biggest), and kasing- means as-as " +
      "(kasingtaas = as tall as).",
    lessonTitles: ["Mas…kaysa", "Pinaka-", "Kasing-", "Weighing options"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a, b] = ctx.comparisonPair();
          if (!a || !b) return null;
          const adj = ctx.adj(a, b);
          return adj && comparison(rng, ctx, { adj, a, b });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const a = ctx.pick(["thing", "food", "drink", "animal", "place", "person"]);
          if (!a) return null;
          const adj = ctx.adj(a);
          return adj && comparison(rng, ctx, { adj, a, b: a, mode: "pinaka" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a, b] = ctx.comparisonPair();
          if (!a || !b) return null;
          const adj = ctx.adj(a, b);
          return adj && comparison(rng, ctx, { adj, a, b, mode: "kasing" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a, b] = ctx.comparisonPair();
          if (!a || !b) return null;
          const adj = ctx.adj(a, b);
          if (!adj) return null;
          return S({
            tl: tlSentence(["mas", adj.tl, "ang", a.tl, "kaysa", "sa", b.tl, ",", "sa", "tingin", "ko"]),
            en: enSentence(["I think the", a.en, "is", comparative(adj.en), "than the", b.en]),
            key: { word: "tingin", options: ["tingin", "palagay", "alam"] },
            gloss: [{ tl: "sa tingin ko", en: "I think" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const [a, b] = ctx.comparisonPair();
      if (!a || !b) return null;
      const adj = ctx.adj(a, b);
      if (!adj) return null;
      return {
        q: S({
          tl: tlSentence(["alin", "ang", `mas ${adj.tl}`, ",", "ang", a.tl, "o", "ang", b.tl], { q: true }),
          en: enSentence(["which is", comparative(adj.en), ", the", a.en, "or the", b.en], { q: true }),
          q: true,
          key: { word: "alin", options: ["alin", "sino", "ilan"] },
        }),
        a: comparison(rng, ctx, { adj, a, b }),
      };
    },
  },

  {
    id: "object-focus",
    title: "Putting the object first",
    tip:
      "When the interesting part is the thing, not the doer, Tagalog switches " +
      "focus: Kumain ako ng isda (I ate fish) becomes Kinain ko ang isda (I ate " +
      "the fish). The doer turns into ko/mo/niya and ang marks the object.",
    lessonTitles: ["Kinain ko ang…", "Done to it", "Doing it now", "Which focus?"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.objectAction();
          return act && objectFocus(rng, ctx, { ...act, pron: ctx.pron(), aspect: "comp" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.objectAction();
          return act && objectFocus(rng, ctx, { ...act, pron: ctx.pron(), aspect: "prog" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.objectAction();
          return act && objectFocus(rng, ctx, { ...act, pron: ctx.pron(), aspect: "cont" });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.objectAction();
          if (!act) return null;
          const name = ctx.name();
          const form = act.verb.o.comp;
          return S({
            tl: tlSentence([form, "ni", name, "ang", act.obj.tl]),
            en: enSentence([name, act.verb.en.past, "the", act.obj.en]),
            key: { word: "ni", options: ["ni", "si", "kay"] },
            gloss: [{ tl: form, en: act.verb.en.past }, { tl: act.obj.tl, en: act.obj.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.objectAction();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence([act.verb.o.comp, "mo", "ba", "ang", act.obj.tl], { q: true }),
          en: enSentence(["did you", act.verb.en.base, "the", act.obj.en], { q: true }),
          q: true,
          key: { word: "ba", options: ["ba", "na", "pa"] },
        }),
        a: objectFocus(rng, ctx, { ...act, pron: ctx.pronById("ako"), aspect: "comp" }),
      };
    },
  },

  {
    id: "while-when",
    title: "While and when",
    tip:
      "Habang + happening-now = while. Kapag + happening-now = whenever. Bago " +
      "and pagkatapos need the pronoun in front of the verb: Bago ako umalis…, " +
      "Pagkatapos kong kumain…",
    lessonTitles: ["Habang", "Kapag", "Bago", "Pagkatapos"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p1 = ctx.pronById("ako");
          const p2 = ctx.pronById("siya");
          const c1 = clause(rng, ctx, { aspect: "prog", pron: p1, ...a1 });
          const c2 = clause(rng, ctx, { aspect: "prog", pron: p2, ...a2 });
          return joinClauses(c1, c2, { tl: "habang", en: "while", tlPos: "initial", enPos: "initial", options: ["habang", "kapag", "bago"] });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pronById("ako");
          const c1 = clause(rng, ctx, { aspect: "prog", pron: p, ...a1 });
          const c2 = clause(rng, ctx, { aspect: "prog", pron: p, ...a2 });
          return joinClauses(c1, c2, { tl: "kapag", en: "whenever", tlPos: "initial", enPos: "initial", options: ["kapag", "habang", "dahil"] });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const pron = ctx.pron();
          const rest1 = [vf(a1.verb, "inf"), a1.obj ? `ng ${a1.obj.tl}` : null];
          const c2 = clause(rng, ctx, { aspect: "comp", pron, ...a2 });
          return S({
            tl: tlSentence(["bago", pron.ang, ...rest1, ",", lower1(bare(c2.tl))]),
            en: enSentence(["before", pron.en, a1.verb.en.past, a1.obj ? enNP(a1.obj) : null, ",", lower1(bare(c2.en))]),
            key: { word: "bago", options: ["bago", "pagkatapos", "habang"] },
            gloss: [{ tl: "bago", en: "before" }, ...c2.gloss.slice(0, 1)],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const pron = ctx.pron();
          const c2 = clause(rng, ctx, { aspect: "comp", pron, ...a2 });
          return S({
            tl: tlSentence(["pagkatapos", ligate(pron.ng), vf(a1.verb, "inf"), a1.obj ? `ng ${a1.obj.tl}` : null, ",", lower1(bare(c2.tl))]),
            en: enSentence(["after", pron.en, a1.verb.en.past, a1.obj ? enNP(a1.obj) : null, ",", lower1(bare(c2.en))]),
            key: { word: "pagkatapos", options: ["pagkatapos", "bago", "habang"] },
            gloss: [{ tl: "pagkatapos", en: "after" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const [a1, a2] = [ctx.action(), ctx.action()];
      if (!a1 || !a2) return null;
      const p = ctx.pronById("ako");
      return {
        q: S({
          tl: tlSentence(["ano", "ang", "ginagawa", "mo", "habang", "naghihintay", "ka"], { q: true }),
          en: "What do you do while you are waiting?",
          q: true,
          key: { word: "habang", options: ["habang", "kapag", "bago"] },
        }),
        a: clause(rng, ctx, { aspect: "prog", pron: p, ...a1 }),
      };
    },
  },

  {
    id: "making-plans",
    title: "Plans and intentions",
    tip:
      "Balak and plano both mean plan to, and both take the linker on the " +
      "ng-pronoun: Balak kong pumunta. Pair them with a future time word for a " +
      "complete plan.",
    lessonTitles: ["Balak ko", "Plano namin", "Setting a time", "Talking it over"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["balak", ligate(pron.ng), vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null, act.place ? `sa ${act.place.tl}` : null]),
            en: enSentence([pron.en, pron.third ? "plans to" : "plan to", act.verb.en.base, act.obj ? enNP(act.obj) : null, act.place ? atThe(act.place) : null]),
            key: { word: "balak", options: ["balak", "gusto", "ayaw"] },
            gloss: [{ tl: "balak", en: "plan to" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const time = ctx.time("cont");
          return clause(rng, ctx, { aspect: "cont", pron: ctx.pron(), ...act, time });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const day = ctx.day();
          return S({
            tl: tlSentence(["sa", day.tl, "kami", vf(act.verb, "cont"), act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence(["we will", act.verb.en.base, act.obj ? enNP(act.obj) : null, "on", day.en]),
            key: { word: day.tl, options: options(day.tl, ctx.dayPool().map((x) => x.tl)) },
            gloss: [{ tl: day.tl, en: day.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["tara", ",", vf(act.verb, "inf"), "tayo", act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence(["come on, let us", act.verb.en.base, act.obj ? enNP(act.obj) : null]),
            accept: [enSentence(["come on, let's", act.verb.en.base, act.obj ? enNP(act.obj) : null])],
            key: { word: "tara", options: ["tara", "sige", "hindi"] },
            gloss: [{ tl: "tara", en: "come on / let us go" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: "Ano ang balak mo bukas?",
          en: "What is your plan tomorrow?",
          q: true,
          key: { word: "balak", options: ["balak", "gusto", "kaya"] },
        }),
        a: clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("ako"), ...act, time: ctx.timeById("bukas") }),
      };
    },
  },

  {
    id: "because-so",
    title: "Because and so",
    tip:
      "Dahil introduces the reason and follows the result; kaya does the " +
      "opposite and introduces the result. Same two facts, opposite order: " +
      "Kumain ako dahil gutom ako / Gutom ako kaya kumain ako.",
    lessonTitles: ["Dahil", "Kaya", "Cause and effect", "Explaining yourself"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          const c1 = clause(rng, ctx, { aspect: "comp", pron: p, ...a1 });
          const c2 = clause(rng, ctx, { aspect: "comp", pron: p, ...a2 });
          return joinClauses(c1, c2, { tl: "dahil", en: "because", options: ["dahil", "kaya", "pero"] });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          const c1 = clause(rng, ctx, { aspect: "comp", pron: p, ...a1 });
          const c2 = clause(rng, ctx, { aspect: "comp", pron: p, ...a2 });
          return joinClauses(c1, c2, { tl: "kaya", en: "so", options: ["kaya", "dahil", "pero"] });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const state = ctx.state();
          const p = ctx.pron();
          const c = clause(rng, ctx, { aspect: "comp", pron: p, ...act });
          return S({
            tl: `${bare(c.tl)} dahil ${state.tl} ${p.ang}.`,
            en: `${bare(c.en)} because ${p.en.toLowerCase()} ${p.past} ${state.en}.`,
            key: { word: "dahil", options: ["dahil", "kaya", "habang"] },
            gloss: [{ tl: state.tl, en: state.en }],
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
            key: { word: "bakit", options: ["bakit", "kailan", "paano"] },
            gloss: [{ tl: "bakit", en: "why" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      const state = ctx.state();
      return {
        q: S({
          tl: tlSentence(["bakit", "ka", vf(act.verb, "comp")], { q: true }),
          en: enSentence(["why did you", act.verb.en.base], { q: true }),
          q: true,
          key: { word: "bakit", options: ["bakit", "kailan", "paano"] },
        }),
        a: S({
          tl: tlSentence(["dahil", state.tl, "ako"]),
          en: enSentence(["because I was", state.en]),
          key: { word: "dahil", options: ["dahil", "kaya", "pero"] },
        }),
      };
    },
  },

  {
    id: "describing-people",
    title: "Describing people and things",
    tip:
      "Stick the adjective to the noun with the linker and you get a full " +
      "description: mabait na guro, magandang bahay. Sobrang before an " +
      "adjective means extremely.",
    lessonTitles: ["Adjective + noun", "Sobrang…", "Ang ganda!", "Full descriptions"],
    makers: [
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const adj = ctx.adj("person");
          const name = ctx.name();
          if (!adj) return null;
          return S({
            tl: tlSentence([modify(adj.tl, person.tl), "si", name]),
            en: enSentence([name, "is", /^[aeiou]/i.test(adj.en) ? "an" : "a", adj.en, person.en]),
            key: { word: ligate(adj.tl).split(" ")[0], options: options(ligate(adj.tl).split(" ")[0], ctx.adjPool("person").map((x) => ligate(x.tl).split(" ")[0])) },
            gloss: [{ tl: modify(adj.tl, person.tl), en: `${adj.en} ${person.en}` }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "animal", "person"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          return S({
            tl: tlSentence(["sobrang", adj.tl, "ng", noun.tl]),
            en: enSentence(["the", noun.en, "is extremely", adj.en]),
            key: { word: "sobrang", options: ["sobrang", "medyo", "hindi"] },
            gloss: [{ tl: "sobrang", en: "extremely" }, { tl: adj.tl, en: adj.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "animal", "person"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          const root = adj.tl.replace(/^ma/, "");
          return S({
            tl: tlSentence(["ang", root, "ng", noun.tl], { bang: true }),
            en: enSentence(["how", adj.en, "the", noun.en, "is"], { bang: true }),
            key: { word: "ang", options: ["ang", "ng", "sa"] },
            gloss: [{ tl: `ang ${root}`, en: `how ${adj.en}` }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "animal", "person"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          return S({
            tl: tlSentence(["medyo", adj.tl, "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is a bit", adj.en]),
            key: { word: "medyo", options: ["medyo", "sobrang", "hindi"] },
            gloss: [{ tl: "medyo", en: "a bit / somewhat" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["thing", "food", "drink", "place", "animal", "person"]);
      if (!noun) return null;
      const adj = ctx.adj(noun);
      if (!adj) return null;
      return {
        q: S({
          tl: tlSentence(["kumusta", "ang", noun.tl], { q: true }),
          en: enSentence(["how is the", noun.en], { q: true }),
          q: true,
          key: { word: "kumusta", options: ["kumusta", "kanino", "ilan"] },
        }),
        a: S({
          tl: tlSentence(["sobrang", adj.tl, "ng", noun.tl]),
          en: enSentence(["the", noun.en, "is extremely", adj.en]),
          key: { word: "sobrang", options: ["sobrang", "medyo", "hindi"] },
        }),
      };
    },
  },

  {
    id: "polite-requests",
    title: "Asking nicely",
    tip:
      "Maaari and puwede both open a request; add ba and the ng-pronoun for " +
      "please-could-you: Maaari mo bang buksan ang pinto? Po and opo make " +
      "anything more respectful.",
    lessonTitles: ["Maaari ba…", "Puwede mo bang…", "With po", "Requests and replies"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.objectAction();
          if (!act) return null;
          return S({
            tl: tlSentence(["maaari", "mo", "bang", act.verb.o.inf, "ang", act.obj.tl], { q: true }),
            en: enSentence(["could you", act.verb.en.base, "the", act.obj.en], { q: true }),
            q: true,
            key: { word: "maaari", options: ["maaari", "puwede", "gusto"] },
            gloss: [{ tl: "maaari mo bang", en: "could you" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["puwede", "mo", "bang", vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null], { q: true }),
            en: enSentence(["can you", act.verb.en.base, act.obj ? enNP(act.obj) : null], { q: true }),
            q: true,
            key: { word: "puwede", options: ["puwede", "maaari", "kaya"] },
            gloss: [{ tl: "puwede mo bang", en: "can you" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence([vf(act.verb, "imp"), "po", "kayo", act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence(["please", act.verb.en.base, act.obj ? enNP(act.obj) : null]),
            key: { word: "po", options: ["po", "ba", "na"] },
            gloss: [{ tl: "po", en: "(politeness marker)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["pasensiya", "na", "po", ",", "hindi", "ko", "kayang", vf(act.verb, "inf")]),
            en: enSentence(["sorry, I cannot", act.verb.en.base]),
            accept: [enSentence(["sorry, I can't", act.verb.en.base])],
            key: { word: "pasensiya", options: ["pasensiya", "salamat", "sige"] },
            gloss: [{ tl: "pasensiya na po", en: "sorry (polite)" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence(["puwede", "mo", "bang", vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null], { q: true }),
          en: enSentence(["can you", act.verb.en.base, act.obj ? enNP(act.obj) : null], { q: true }),
          q: true,
          key: { word: "puwede", options: ["puwede", "maaari", "kaya"] },
        }),
        a: S({
          tl: "Sige po, walang problema.",
          en: "Sure, no problem.",
          key: { word: "Sige", options: ["Sige", "Hindi", "Huwag"] },
        }),
      };
    },
  },
].map((f) => ({ ...f, tier: "conversational" }));

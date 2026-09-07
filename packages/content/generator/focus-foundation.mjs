/**
 * Foundations-tier grammar focuses: naming things, having things, describing
 * them, counting them and saying where they are. Sentences stay to one clause
 * and lean on the theme's own nouns.
 */

import { atThe, enNP, ligate, tlSentence, enSentence, modify } from "./grammar.mjs";
import { S, options, adjPredicate, possession, located, wants } from "./makers.mjs";

const THING_CATS = ["thing", "food", "drink", "animal", "person", "place"];

export const FOUNDATION_FOCUSES = [
  {
    id: "naming",
    title: "Naming things",
    tip:
      "Tagalog needs no word for is/are. Put the thing first and the pointer " +
      "second: Mansanas ito = (an) apple this = This is an apple. Ito is what " +
      "you are holding, iyan is near the listener, iyon is over there.",
    lessonTitles: ["This is…", "That one", "Not that", "Point and name"],
    makers: [
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          return S({
            tl: tlSentence([noun.tl, "ito"]),
            en: enSentence(["this is", enNP(noun)]),
            key: { word: noun.tl, options: options(noun.tl, ctx.themePool().map((x) => x.tl)) },
            gloss: [{ tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const dem = rng.pick([
            { tl: "iyan", en: "that" },
            { tl: "iyon", en: "that over there" },
          ]);
          return S({
            tl: tlSentence([noun.tl, dem.tl]),
            en: enSentence([dem.en, "is", enNP(noun)]),
            key: { word: dem.tl, options: options(dem.tl, ["ito", "iyan", "iyon"]) },
            gloss: [{ tl: dem.tl, en: dem.en }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const [noun, other] = ctx.sample(THING_CATS, 2);
          if (!noun || !other) return null;
          return S({
            tl: tlSentence(["hindi", noun.tl, "ito"]),
            en: enSentence(["this is not", enNP(noun)]),
            accept: [enSentence(["this isn't", enNP(noun)])],
            key: { word: "hindi", options: ["hindi", "ito", "oo"] },
            gloss: [{ tl: "hindi", en: "not" }, { tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          return S({
            tl: tlSentence(["ito", "ay", noun.tl]),
            en: enSentence(["this is", enNP(noun)]),
            key: { word: "ay", options: ["ay", "ang", "ng"] },
            gloss: [{ tl: "ito ay", en: "this is" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(THING_CATS);
      if (!noun) return null;
      return {
        q: S({ tl: "Ano ito?", en: "What is this?", q: true, key: { word: "Ano", options: ["Ano", "Sino", "Saan"] } }),
        a: S({
          tl: tlSentence([noun.tl, "ito"]),
          en: enSentence(["this is", enNP(noun)]),
          key: { word: noun.tl, options: options(noun.tl, ctx.themePool().map((x) => x.tl)) },
        }),
      };
    },
  },

  {
    id: "possession",
    title: "Having and not having",
    tip:
      "May + thing + owner = have: May kotse ako (I have a car). The negative " +
      "flips the shape — wala takes the linker on the pronoun: Wala akong kotse " +
      "(I have no car).",
    lessonTitles: ["May…", "Wala…", "Who has what", "Have and have not"],
    makers: [
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          if (!noun) return null;
          return possession(rng, ctx, { noun, pron: ctx.pron() });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          if (!noun) return null;
          return possession(rng, ctx, { noun, pron: ctx.pron(), negate: true });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          if (!noun) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["may", noun.tl, "si", name]),
            en: enSentence([name, "has", enNP(noun)]),
            key: { word: "may", options: ["may", "wala", "ang"] },
            gloss: [{ tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          const pron = ctx.pron();
          if (!noun) return null;
          return S({
            tl: tlSentence(["mayroon", ligate(pron.ang), noun.tl]),
            en: enSentence([pron.en, pron.third ? "has" : "have", enNP(noun)]),
            key: { word: "mayroon", options: ["mayroon", "wala", "hindi"] },
            gloss: [{ tl: "mayroon", en: "there is / have" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["thing", "food", "drink", "animal"]);
      if (!noun) return null;
      return {
        q: S({
          tl: tlSentence(["may", noun.tl, "ka", "ba"], { q: true }),
          en: enSentence(["do you have", enNP(noun)], { q: true }),
          q: true,
          key: { word: "ba", options: ["ba", "na", "pa"] },
        }),
        a: possession(rng, ctx, { noun, pron: ctx.pronById("ako") }),
      };
    },
  },

  {
    id: "describing",
    title: "Describing things",
    tip:
      "The adjective comes first and ang marks what it describes: Masarap ang " +
      "adobo = The adobo is delicious. To stick an adjective onto a noun " +
      "instead, add the linker: maganda + bahay = magandang bahay.",
    lessonTitles: ["It is…", "It is not…", "Adjective + noun", "Describe it"],
    makers: [
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          if (!adj) return null;
          return adjPredicate(rng, ctx, { adj, noun });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          if (!adj) return null;
          return adjPredicate(rng, ctx, { adj, noun, negate: true });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal", "place"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal", "place"]);
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          const pron = ctx.pron();
          if (!adj) return null;
          return S({
            tl: tlSentence(["may", modify(adj.tl, noun.tl), pron.ang]),
            en: enSentence([pron.en, pron.third ? "has" : "have", noun.mass ? `${adj.en} ${noun.en}` : `${/^[aeiou]/i.test(adj.en) ? "an" : "a"} ${adj.en} ${noun.en}`]),
            key: { word: ligate(adj.tl).split(" ")[0], options: options(ligate(adj.tl).split(" ")[0], ctx.adjPool(noun.cat).map((x) => ligate(x.tl).split(" ")[0])) },
            gloss: [{ tl: modify(adj.tl, noun.tl), en: `${adj.en} ${noun.en}` }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          const pron = ctx.pron();
          if (!adj) return null;
          return S({
            tl: tlSentence(["ang", noun.tl, pron.ng, "ay", adj.tl]),
            en: enSentence([pron.poss, noun.en, "is", adj.en]),
            key: { word: adj.tl, options: options(adj.tl, ctx.adjPool(noun.cat).map((x) => x.tl)) },
            gloss: [{ tl: `${noun.tl} ${pron.ng}`, en: `${pron.poss} ${noun.en}` }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(THING_CATS);
      if (!noun) return null;
      const adj = ctx.adj(noun.cat);
      if (!adj) return null;
      return {
        q: S({
          tl: tlSentence([adj.tl, "ba", "ang", noun.tl], { q: true }),
          en: enSentence(["is the", noun.en, adj.en], { q: true }),
          q: true,
          key: { word: adj.tl, options: options(adj.tl, ctx.adjPool(noun.cat).map((x) => x.tl)) },
        }),
        a: adjPredicate(rng, ctx, { adj, noun }),
      };
    },
  },

  {
    id: "counting",
    title: "Counting them",
    tip:
      "A number modifies a noun through the linker, exactly like an adjective: " +
      "lima + mansanas = limang mansanas (five apples). Numbers ending in a " +
      "consonant take na instead: apat na mangga.",
    lessonTitles: ["One to five", "How many?", "Counting up", "Numbers in use"],
    makers: [
      {
        needs: ["thing", "food", "drink", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal", "person"], { countable: true });
          if (!noun) return null;
          const num = ctx.number();
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["may", ligate(num.tl), noun.tl, pron.ang]),
            en: enSentence([pron.en, pron.third ? "has" : "have", num.en, enNP(noun, { plural: num.value > 1 })]),
            key: { word: ligate(num.tl).split(" ")[0], options: options(ligate(num.tl).split(" ")[0], ctx.numberPool().map((x) => ligate(x.tl).split(" ")[0])) },
            gloss: [{ tl: num.tl, en: num.en }, { tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal", "person"], { countable: true });
          if (!noun) return null;
          const num = ctx.number();
          return S({
            tl: tlSentence([ligate(num.tl), noun.tl, "ang", "nasa", "mesa"]),
            en: enSentence([num.en, enNP(noun, { plural: num.value > 1 }), num.value > 1 ? "are" : "is", "on the table"]),
            key: { word: "nasa", options: ["nasa", "sa", "ang"] },
            gloss: [{ tl: num.tl, en: num.en }],
          });
        },
      },
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          if (!noun) return null;
          const num = ctx.number({ big: true });
          return S({
            tl: tlSentence([ligate(num.tl), "piso", "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is", num.en, "pesos"]),
            key: { word: "piso", options: ["piso", "kilo", "oras"] },
            gloss: [{ tl: `${ligate(num.tl)} piso`, en: `${num.en} pesos` }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["thing", "food", "drink", "animal", "person"], { countable: true });
      if (!noun) return null;
      const num = ctx.number();
      return {
        q: S({
          tl: tlSentence(["ilan", "ang", noun.tl], { q: true }),
          en: enSentence(["how many", enNP(noun, { plural: true }), "are there"], { q: true }),
          q: true,
          key: { word: "ilan", options: ["ilan", "ano", "sino"] },
        }),
        a: S({
          tl: tlSentence([ligate(num.tl), noun.tl]),
          en: enSentence([num.en, enNP(noun, { plural: num.value > 1 })]),
          key: { word: ligate(num.tl).split(" ")[0], options: options(ligate(num.tl).split(" ")[0], ctx.numberPool().map((x) => ligate(x.tl).split(" ")[0])) },
        }),
      };
    },
  },

  {
    id: "location",
    title: "Where things are",
    tip:
      "Nasa answers where something is: Nasa palengke ako (I am at the market). " +
      "For is-not-there, Tagalog uses wala rather than hindi: Wala ako sa bahay.",
    lessonTitles: ["Nasa…", "Not there", "Where is it?", "Places and things"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => located(rng, ctx, { place: ctx.place(), pron: ctx.pron() }),
      },
      {
        needs: [],
        make: (rng, ctx) => located(rng, ctx, { place: ctx.place(), pron: ctx.pron(), negate: true }),
      },
      {
        needs: ["thing", "food", "drink", "animal"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "animal"]);
          if (!noun) return null;
          return located(rng, ctx, { place: ctx.place(), noun });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          const name = ctx.name();
          return S({
            tl: tlSentence(["nasa", place.tl, "si", name]),
            en: enSentence([name, "is", atThe(place)]),
            key: { word: place.tl, options: options(place.tl, ctx.placePool().map((x) => x.tl)) },
            gloss: [{ tl: place.tl, en: place.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const place = ctx.place();
      return {
        q: S({
          tl: "Nasaan ka?",
          en: "Where are you?",
          q: true,
          key: { word: "Nasaan", options: ["Nasaan", "Ano", "Kailan"] },
        }),
        a: located(rng, ctx, { place, pron: ctx.pronById("ako") }),
      };
    },
  },

  {
    id: "wants",
    title: "Wanting and not wanting",
    tip:
      "Gusto and ayaw take the ng-pronoun (ko, mo, niya) for the wanter and ng " +
      "for the thing wanted: Gusto ko ng kape. Say it with ang instead and it " +
      "means the specific one: Gusto ko ang kape.",
    lessonTitles: ["Gusto ko…", "Ayaw ko…", "What do you want?", "Wants and offers"],
    makers: [
      {
        needs: ["food", "drink", "thing"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["food", "drink", "thing"]);
          if (!noun) return null;
          return wants(rng, ctx, { noun, pron: ctx.pron() });
        },
      },
      {
        needs: ["food", "drink", "thing"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["food", "drink", "thing"]);
          if (!noun) return null;
          return wants(rng, ctx, { noun, pron: ctx.pron(), verbWord: "ayaw" });
        },
      },
      {
        needs: ["food", "drink", "thing"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["food", "drink", "thing"]);
          if (!noun) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["gusto", "ni", name, "ng", noun.tl]),
            en: enSentence([name, "wants", enNP(noun)]),
            key: { word: "ni", options: ["ni", "si", "kay"] },
            gloss: [{ tl: `gusto ni ${name}`, en: `${name} wants` }],
          });
        },
      },
      {
        needs: ["food", "drink", "thing"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["food", "drink", "thing"]);
          if (!noun) return null;
          return S({
            tl: tlSentence(["gusto", "mo", "ba", "ng", noun.tl], { q: true }),
            en: enSentence(["do you want", enNP(noun)], { q: true }),
            q: true,
            key: { word: "ba", options: ["ba", "na", "pa"] },
            gloss: [{ tl: noun.tl, en: noun.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["food", "drink", "thing"]);
      if (!noun) return null;
      return {
        q: S({
          tl: tlSentence(["ano", "ang", "gusto", "mo"], { q: true }),
          en: "What do you want?",
          q: true,
          key: { word: "gusto", options: ["gusto", "ayaw", "may"] },
        }),
        a: wants(rng, ctx, { noun, pron: ctx.pronById("ako") }),
      };
    },
  },

  {
    id: "plurals",
    title: "More than one",
    tip:
      "Tagalog nouns do not change shape in the plural — mga does the work: " +
      "ang mga bata (the children). Marami means many, and it links to what " +
      "follows: maraming bata.",
    lessonTitles: ["Mga", "Marami", "Many at once", "One or many"],
    makers: [
      {
        needs: ["thing", "food", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "animal", "person"], { countable: true });
          if (!noun) return null;
          const place = ctx.place();
          return S({
            tl: tlSentence(["maraming", noun.tl, "sa", place.tl]),
            en: enSentence(["there are many", enNP(noun, { plural: true }), atThe(place)]),
            key: { word: "maraming", options: ["maraming", "kaunting", "walang"] },
            gloss: [{ tl: "marami", en: "many" }, { tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: ["thing", "food", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "animal", "person"], { countable: true });
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          if (!adj) return null;
          return S({
            tl: tlSentence([adj.tl, "ang", "mga", noun.tl]),
            en: enSentence(["the", enNP(noun, { plural: true }).replace(/^the /, ""), "are", adj.en]),
            key: { word: "mga", options: ["mga", "ang", "ng"] },
            gloss: [{ tl: `mga ${noun.tl}`, en: enNP(noun, { plural: true }) }],
          });
        },
      },
      {
        needs: ["thing", "food", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "animal", "person"], { countable: true });
          if (!noun) return null;
          const place = ctx.place();
          return S({
            tl: tlSentence(["may", "mga", noun.tl, "sa", place.tl]),
            en: enSentence(["there are", enNP(noun, { plural: true }), atThe(place)]),
            key: { word: place.tl, options: options(place.tl, ctx.placePool().map((x) => x.tl)) },
            gloss: [{ tl: place.tl, en: place.en }],
          });
        },
      },
      {
        needs: ["thing", "food", "animal", "person"],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "animal", "person"], { countable: true });
          if (!noun) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["kaunti", "ang", "mga", noun.tl, pron.ng]),
            en: enSentence([pron.en, pron.third ? "has few" : "have few", enNP(noun, { plural: true })]),
            key: { word: "kaunti", options: ["kaunti", "marami", "wala"] },
            gloss: [{ tl: "kaunti", en: "few" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["thing", "food", "animal", "person"], { countable: true });
      if (!noun) return null;
      const place = ctx.place();
      return {
        q: S({
          tl: tlSentence(["may", "mga", noun.tl, "ba", "sa", place.tl], { q: true }),
          en: enSentence(["are there", enNP(noun, { plural: true }), atThe(place)], { q: true }),
          q: true,
          key: { word: "mga", options: ["mga", "ang", "ng"] },
        }),
        a: S({
          tl: tlSentence(["oo", ",", "maraming", noun.tl, "doon"]),
          en: enSentence(["yes, there are many", enNP(noun, { plural: true }), "there"]),
          key: { word: "maraming", options: ["maraming", "kaunting", "walang"] },
        }),
      };
    },
  },

  {
    id: "mine-yours",
    title: "Mine and yours",
    tip:
      "Possession is the ng-pronoun sitting after the noun: bahay ko (my house), " +
      "bahay mo (your house), bahay niya (his/her house). Name owners take ni: " +
      "kotse ni Ana.",
    lessonTitles: ["…ko", "…mo and …niya", "Whose is it?", "Mine, yours, theirs"],
    makers: [
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence(["ito", "ang", noun.tl, pron.ng]),
            en: enSentence(["this is", pron.poss, noun.en]),
            key: { word: pron.ng, options: options(pron.ng, ["ko", "mo", "niya", "namin"]) },
            gloss: [{ tl: `${noun.tl} ${pron.ng}`, en: `${pron.poss} ${noun.en}` }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["iyon", "ang", noun.tl, "ni", name]),
            en: enSentence(["that is", `${name}'s`, noun.en]),
            key: { word: "ni", options: ["ni", "si", "kay"] },
            gloss: [{ tl: `ni ${name}`, en: `${name}'s` }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          return S({
            tl: tlSentence(["ito", "ba", "ang", noun.tl, "mo"], { q: true }),
            en: enSentence(["is this your", noun.en], { q: true }),
            q: true,
            key: { word: "mo", options: ["mo", "ko", "niya"] },
            gloss: [{ tl: `${noun.tl} mo`, en: `your ${noun.en}` }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          const adj = ctx.adj(noun.cat);
          if (!adj) return null;
          return S({
            tl: tlSentence([adj.tl, "ang", noun.tl, "namin"]),
            en: enSentence(["our", noun.en, "is", adj.en]),
            key: { word: "namin", options: ["namin", "ko", "nila"] },
            gloss: [{ tl: "namin", en: "our" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(THING_CATS);
      if (!noun) return null;
      return {
        q: S({
          tl: tlSentence(["kanino", "ang", noun.tl], { q: true }),
          en: enSentence(["whose", noun.en, "is this"], { q: true }),
          q: true,
          key: { word: "kanino", options: ["kanino", "sino", "saan"] },
        }),
        a: S({
          tl: tlSentence(["akin", "ang", noun.tl]),
          en: enSentence(["the", noun.en, "is mine"]),
          key: { word: "akin", options: ["akin", "iyo", "kaniya"] },
        }),
      };
    },
  },

  {
    id: "asking",
    title: "First questions",
    tip:
      "Question words come first and ang follows them: Ano ang…? (what), Sino " +
      "ang…? (who), Saan ang…? (where), Magkano ang…? (how much), Ilan ang…? " +
      "(how many).",
    lessonTitles: ["Ano and sino", "Saan", "Magkano", "Ask anything"],
    makers: [
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          return S({
            tl: tlSentence(["magkano", "ang", noun.tl], { q: true }),
            en: enSentence(["how much is the", noun.en], { q: true }),
            q: true,
            key: { word: "magkano", options: ["magkano", "ilan", "saan"] },
            gloss: [{ tl: "magkano", en: "how much" }, { tl: noun.tl, en: noun.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          return S({
            tl: tlSentence(["saan", "ang", place.tl], { q: true }),
            en: enSentence(["where is the", place.en], { q: true }),
            q: true,
            key: { word: "saan", options: ["saan", "ano", "kailan"] },
            gloss: [{ tl: "saan", en: "where" }, { tl: place.tl, en: place.en }],
          });
        },
      },
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          return S({
            tl: tlSentence(["sino", "ang", person.tl], { q: true }),
            en: enSentence(["who is the", person.en], { q: true }),
            q: true,
            key: { word: "sino", options: ["sino", "ano", "ilan"] },
            gloss: [{ tl: "sino", en: "who" }, { tl: person.tl, en: person.en }],
          });
        },
      },
      {
        needs: THING_CATS,
        make: (rng, ctx) => {
          const noun = ctx.pick(THING_CATS);
          if (!noun) return null;
          return S({
            tl: tlSentence(["ano", "ang", "tawag", "dito"], { q: true }),
            en: "What is this called?",
            q: true,
            key: { word: "tawag", options: ["tawag", "pangalan", "presyo"] },
            gloss: [{ tl: "ano ang tawag dito", en: "what is this called" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(THING_CATS);
      if (!noun) return null;
      const num = ctx.number({ big: true });
      return {
        q: S({
          tl: tlSentence(["magkano", "ang", noun.tl], { q: true }),
          en: enSentence(["how much is the", noun.en], { q: true }),
          q: true,
          key: { word: "magkano", options: ["magkano", "ilan", "saan"] },
        }),
        a: S({
          tl: tlSentence([ligate(num.tl), "piso", "po"]),
          en: enSentence([num.en, "pesos"]),
          key: { word: "piso", options: ["piso", "kilo", "oras"] },
        }),
      };
    },
  },

  {
    id: "identity",
    title: "Who someone is",
    tip:
      "Si marks a person as the subject: Guro si Ana (Ana is a teacher). The " +
      "formal order flips it with ay: Si Ana ay guro. Both are right; ay sounds " +
      "like writing, the other like speech.",
    lessonTitles: ["Si Ana ay…", "Job titles", "Introducing people", "Who is who"],
    makers: [
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence([person.tl, "si", name]),
            en: enSentence([name, "is", enNP(person)]),
            key: { word: "si", options: ["si", "ni", "kay"] },
            gloss: [{ tl: person.tl, en: person.en }],
          });
        },
      },
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["si", name, "ay", person.tl]),
            en: enSentence([name, "is", enNP(person)]),
            key: { word: "ay", options: ["ay", "ang", "ng"] },
            gloss: [{ tl: "ay", en: "is (formal)" }],
          });
        },
      },
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const adj = ctx.adj("person");
          if (!adj) return null;
          return S({
            tl: tlSentence(["ang", person.tl, "ay", adj.tl]),
            en: enSentence(["the", person.en, "is", adj.en]),
            key: { word: adj.tl, options: options(adj.tl, ctx.adjPool("person").map((x) => x.tl)) },
            gloss: [{ tl: person.tl, en: person.en }, { tl: adj.tl, en: adj.en }],
          });
        },
      },
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const pron = ctx.pron();
          return S({
            tl: tlSentence([person.tl, pron.ang]),
            en: enSentence([pron.en, pron.be, enNP(person)]),
            key: { word: person.tl, options: options(person.tl, ctx.themePool().map((x) => x.tl)) },
            gloss: [{ tl: person.tl, en: person.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const person = ctx.pick(["person"]);
      if (!person) return null;
      const name = ctx.name();
      return {
        q: S({
          tl: "Sino siya?",
          en: "Who is he?",
          q: true,
          key: { word: "Sino", options: ["Sino", "Ano", "Saan"] },
        }),
        a: S({
          tl: tlSentence([person.tl, "siya", ",", "si", name]),
          en: enSentence(["he is", enNP(person), ", he is", name]),
          key: { word: "si", options: ["si", "ni", "kay"] },
        }),
      };
    },
  },
].map((f) => ({ ...f, tier: "foundation" }));

/**
 * Mastery-tier focuses: everything that needs more than one clause, plus the
 * registers a fluent speaker switches between — formal po, narrative, reported
 * speech, hedged opinion, news style, and figurative language.
 *
 * The idiom and proverb lists here are fixed (they can't be generated), so the
 * makers drill them in context instead of assembling them.
 */

import { atThe, bare, enNP, enSentence, ligate, tlSentence, vf } from "./grammar.mjs";
import { S, options, clause, joinClauses, lower1, aspectOptions } from "./makers.mjs";

/** body-part and everyday idioms, with the literal reading that explains them */
const IDIOMS = [
  { bp: true, tl: "matigas ang ulo", en: "stubborn", lit: "hard-headed" },
  { bp: true, tl: "mababaw ang luha", en: "cries easily", lit: "shallow tears" },
  { bp: true, tl: "bukas ang palad", en: "generous", lit: "open palm" },
  { bp: true, tl: "makati ang dila", en: "cannot keep a secret", lit: "itchy tongue" },
  { bp: true, tl: "mabigat ang kamay", en: "unwilling to help", lit: "heavy hand" },
  { bp: true, tl: "malikot ang kamay", en: "light-fingered", lit: "restless hands" },
  { bp: true, tl: "mahaba ang pisi", en: "very patient", lit: "long rope" },
  { bp: true, tl: "maikli ang pisi", en: "short-tempered", lit: "short rope" },
  { bp: true, tl: "malamig ang dugo", en: "cold-blooded", lit: "cold blood" },
  { bp: true, tl: "mainit ang ulo", en: "hot-tempered", lit: "hot head" },
  { tl: "bukambibig", en: "a favorite saying", lit: "mouth-opening" },
  { tl: "balita sa bayan", en: "the talk of the town", lit: "news in town" },
  { tl: "hindi mahulugang karayom", en: "packed with people", lit: "not even a needle could drop" },
  { tl: "nagbibilang ng poste", en: "jobless", lit: "counting the posts" },
  { tl: "nasa langit", en: "overjoyed", lit: "in heaven" },
  { tl: "kabute sa ulan", en: "popping up everywhere", lit: "mushrooms in the rain" },
];

const PROVERBS = [
  { tl: "Ang hindi lumingon sa pinanggalingan ay hindi makararating sa paroroonan.", en: "One who does not look back at where they came from will not reach their destination." },
  { tl: "Kung may tiyaga, may nilaga.", en: "Patience is rewarded." },
  { tl: "Ang kahoy na liko, hutukin habang malambot.", en: "Correct a crooked tree while it is still soft." },
  { tl: "Nasa Diyos ang awa, nasa tao ang gawa.", en: "Mercy is with God, action is with people." },
  { tl: "Habang may buhay, may pag-asa.", en: "While there is life, there is hope." },
  { tl: "Aanhin pa ang damo kung patay na ang kabayo?", en: "What use is the grass when the horse is already dead?" },
  { tl: "Ang taong nagigipit, sa patalim kumakapit.", en: "A desperate person will grasp even a blade." },
  { tl: "Walang matimtimang birhen sa matiyagang manalangin.", en: "Persistence wins in the end." },
];

const HEDGES = [
  { tl: "siguro", en: "probably" },
  { tl: "baka", en: "maybe" },
  { tl: "mukhang", en: "it seems" },
  { tl: "parang", en: "it is like" },
];

export const MASTERY_FOCUSES = [
  {
    id: "two-clause",
    title: "Two ideas, one sentence",
    tip:
      "At joins, pero contrasts, at saka adds. The second clause keeps its own " +
      "pronoun — Tagalog does not drop it the way English does.",
    lessonTitles: ["At", "Pero", "At saka", "Longer sentences"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          const aspect = rng.pick(["comp", "prog", "cont"]);
          return joinClauses(
            clause(rng, ctx, { aspect, pron: p, ...a1 }),
            clause(rng, ctx, { aspect, pron: p, ...a2 }),
            { tl: "at", en: "and", options: ["at", "pero", "kaya"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          return joinClauses(
            clause(rng, ctx, { aspect: "comp", pron: p, ...a1 }),
            clause(rng, ctx, { aspect: "comp", pron: p, ...a2, negate: true }),
            { tl: "pero", en: "but", options: ["pero", "at", "dahil"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action({ wantPlace: true })];
          if (!a1 || !a2) return null;
          return joinClauses(
            clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("kami"), ...a1 }),
            clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("kami"), ...a2 }),
            { tl: "at saka", en: "and then", options: ["at saka", "pero", "dahil"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          return joinClauses(
            clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("siya"), ...a1 }),
            clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("ako"), ...a2 }),
            { tl: "samantalang", en: "whereas", options: ["samantalang", "pero", "at"] },
          );
        },
      },
    ],
    qa: (rng, ctx) => {
      const [a1, a2] = [ctx.action(), ctx.action()];
      if (!a1 || !a2) return null;
      return {
        q: S({
          tl: "Ano ang ginawa mo kaninang umaga?",
          en: "What did you do this morning?",
          q: true,
          key: { word: "Ano", options: ["Ano", "Sino", "Saan"] },
        }),
        a: joinClauses(
          clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...a1 }),
          clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...a2 }),
          { tl: "at", en: "and", options: ["at", "pero", "kaya"] },
        ),
      };
    },
  },

  {
    id: "formal-po",
    title: "The respectful register",
    tip:
      "Po and ho soften a sentence; kayo replaces ka for one respected person. " +
      "Opo is the polite yes, and requests open with maaari po ba. Elders, " +
      "officials and strangers all get this register.",
    lessonTitles: ["Po and opo", "Kayo, not ka", "Polite requests", "Speaking to elders"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence([vf(act.verb, "comp"), "po", "ako", act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence(["I", act.verb.en.past, act.obj ? enNP(act.obj) : null]),
            key: { word: "po", options: ["po", "ba", "na"] },
            gloss: [{ tl: "po", en: "(respect marker)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence([vf(act.verb, "prog"), "po", "ba", "kayo", act.obj ? `ng ${act.obj.tl}` : null], { q: true }),
            en: enSentence(["are you", act.verb.en.ing, act.obj ? enNP(act.obj) : null], { q: true }),
            q: true,
            key: { word: "kayo", options: ["kayo", "ka", "sila"] },
            gloss: [{ tl: "kayo", en: "you (respectful)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["maaari", "po", "ba", "akong", vf(act.verb, "inf"), act.obj ? `ng ${act.obj.tl}` : null], { q: true }),
            en: enSentence(["may I", act.verb.en.base, act.obj ? enNP(act.obj) : null], { q: true }),
            q: true,
            key: { word: "maaari", options: ["maaari", "gusto", "kaya"] },
            gloss: [{ tl: "maaari po ba", en: "may I (polite)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]) ?? { tl: "matanda", en: "elder" };
          return S({
            tl: tlSentence(["opo", ",", "salamat", "po", ",", person.tl]),
            en: enSentence(["yes, thank you,", person.en]),
            key: { word: "opo", options: ["opo", "oo", "hindi"] },
            gloss: [{ tl: "opo", en: "yes (respectful)" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: tlSentence([vf(act.verb, "comp"), "na", "po", "ba", "kayo"], { q: true }),
          en: enSentence(["have you", act.verb.en.past, "already"], { q: true }),
          q: true,
          key: { word: "po", options: ["po", "ba", "na"] },
        }),
        a: S({
          tl: tlSentence(["opo", ",", vf(act.verb, "comp"), "na", "po", "ako"]),
          en: enSentence(["yes, I already", act.verb.en.past]),
          key: { word: "opo", options: ["opo", "oo", "hindi"] },
        }),
      };
    },
  },

  {
    id: "narrative",
    title: "Telling what happened",
    tip:
      "A story runs on the completed aspect with markers doing the sequencing: " +
      "noong (back when), pagkatapos (after that), sa wakas (finally). Keep the " +
      "aspect steady and let the markers move the time.",
    lessonTitles: ["Noong…", "Pagkatapos", "Sa wakas", "A whole story"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("ako"), ...act });
          return S({
            tl: `Noong isang taon, ${lower1(bare(c.tl))}.`,
            en: `A year ago, ${lower1(bare(c.en))}.`,
            key: { word: "Noong", options: ["Noong", "Kapag", "Habang"] },
            gloss: [{ tl: "noong isang taon", en: "a year ago" }, ...c.gloss.slice(0, 1)],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const c1 = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("kami"), ...a1 });
          const c2 = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("kami"), ...a2 });
          return S({
            tl: `${bare(c1.tl)}. Pagkatapos, ${lower1(bare(c2.tl))}.`,
            en: `${bare(c1.en)}. After that, ${lower1(bare(c2.en))}.`,
            key: { word: "Pagkatapos", options: ["Pagkatapos", "Bago", "Habang"] },
            gloss: [{ tl: "pagkatapos", en: "after that" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Sa wakas, ${lower1(bare(c.tl))}.`,
            en: `Finally, ${lower1(bare(c.en))}.`,
            key: { word: "wakas", options: ["wakas", "simula", "gitna"] },
            gloss: [{ tl: "sa wakas", en: "finally" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          const name = ctx.name();
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("siya"), ...act });
          return S({
            tl: `Isang araw, ${lower1(bare(c.tl)).replace(/\bsiya\b/, `si ${name}`)}.`,
            en: `One day, ${lower1(bare(c.en)).replace(/^he\b/, name).replace(/^she\b/, name)}.`,
            key: { word: "araw", options: ["araw", "gabi", "taon"] },
            gloss: [{ tl: "isang araw", en: "one day" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action({ wantPlace: true });
      if (!act) return null;
      return {
        q: S({
          tl: "Ano ang nangyari noong isang linggo?",
          en: "What happened last week?",
          q: true,
          key: { word: "nangyari", options: ["nangyari", "gagawin", "ginagawa"] },
        }),
        a: clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("kami"), ...act }),
      };
    },
  },

  {
    id: "reported",
    title: "Reporting what people said",
    tip:
      "Sabi ni X = X said. Tagalog does not shift the tense the way English " +
      "does: Sabi niya, kumakain siya keeps the original aspect. Use na before " +
      "a full clause: Sinabi niya na…",
    lessonTitles: ["Sabi ni…", "Sinabi niya na…", "Asking what was said", "Passing it on"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const name = ctx.name();
          const c = clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("siya"), ...act });
          return S({
            tl: `Sabi ni ${name}, ${lower1(bare(c.tl))}.`,
            en: `${name} said ${lower1(bare(c.en))}.`,
            key: { word: "Sabi", options: ["Sabi", "Tanong", "Sagot"] },
            gloss: [{ tl: `sabi ni ${name}`, en: `${name} said` }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("siya"), ...act });
          return S({
            tl: `Sinabi niya na ${lower1(bare(c.tl))}.`,
            en: `He said that ${lower1(bare(c.en))}.`,
            key: { word: "na", options: ["na", "ba", "pa"] },
            gloss: [{ tl: "sinabi niya na", en: "he said that" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const name = ctx.name();
          return S({
            tl: tlSentence(["ano", "ang", "sabi", "ni", name], { q: true }),
            en: enSentence(["what did", name, "say"], { q: true }),
            q: true,
            key: { word: "sabi", options: ["sabi", "tanong", "gawa"] },
            gloss: [{ tl: "ano ang sabi", en: "what did (someone) say" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Balita ko, ${lower1(bare(c.tl))}.`,
            en: `I heard that ${lower1(bare(c.en))}.`,
            key: { word: "Balita", options: ["Balita", "Sabi", "Tanong"] },
            gloss: [{ tl: "balita ko", en: "I heard / word reached me" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      const name = ctx.name();
      return {
        q: S({
          tl: tlSentence(["ano", "ang", "sabi", "ni", name], { q: true }),
          en: enSentence(["what did", name, "say"], { q: true }),
          q: true,
          key: { word: "sabi", options: ["sabi", "tanong", "gawa"] },
        }),
        a: (() => {
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("siya"), ...act });
          return S({
            tl: `Sabi niya, ${lower1(bare(c.tl))}.`,
            en: `He said ${lower1(bare(c.en))}.`,
            key: { word: "Sabi", options: ["Sabi", "Balita", "Tanong"] },
          });
        })(),
      };
    },
  },

  {
    id: "conditionals",
    title: "If and unless",
    tip:
      "Kung + a fact = if; kapag + a habit = whenever. The result clause takes " +
      "the contemplated aspect for something that has not happened yet: Kung " +
      "uulan, hindi ako aalis.",
    lessonTitles: ["Kung…", "Kapag…", "What would happen", "Making conditions"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          return joinClauses(
            clause(rng, ctx, { aspect: "cont", pron: p, ...a1 }),
            clause(rng, ctx, { aspect: "cont", pron: p, ...a2 }),
            { tl: "kung", en: "if", tlPos: "initial", enPos: "initial", options: ["kung", "kapag", "dahil"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          return joinClauses(
            clause(rng, ctx, { aspect: "prog", pron: p, ...a1 }),
            clause(rng, ctx, { aspect: "prog", pron: p, ...a2 }),
            { tl: "kapag", en: "whenever", tlPos: "initial", enPos: "initial", options: ["kapag", "kung", "habang"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          const c1 = clause(rng, ctx, { aspect: "cont", pron: p, ...a1, negate: true });
          const c2 = clause(rng, ctx, { aspect: "cont", pron: p, ...a2 });
          return S({
            tl: `Kung ${lower1(bare(c1.tl))}, ${lower1(bare(c2.tl))}.`,
            en: `If ${lower1(bare(c1.en))}, ${lower1(bare(c2.en))}.`,
            key: { word: "Kung", options: ["Kung", "Kapag", "Kahit"] },
            gloss: [{ tl: "kung hindi", en: "if not" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pron(), ...act });
          return S({
            tl: `Kung uulan bukas, ${lower1(bare(c.tl))}.`,
            en: `If it rains tomorrow, ${lower1(bare(c.en))}.`,
            key: { word: "uulan", options: ["uulan", "umuulan", "umulan"] },
            gloss: [{ tl: "kung uulan", en: "if it rains" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: "Ano ang gagawin mo kung uulan bukas?",
          en: "What will you do if it rains tomorrow?",
          q: true,
          key: { word: "kung", options: ["kung", "kapag", "kahit"] },
        }),
        a: clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("ako"), ...act }),
      };
    },
  },

  {
    id: "concession",
    title: "Even if, anyway",
    tip:
      "Kahit means even/even if and can stand in front of a clause or a single " +
      "word: kahit umuulan, kahit sandali. Pair it with pa rin (still) for the " +
      "full effect.",
    lessonTitles: ["Kahit", "Pa rin", "Standing your ground", "Concessions"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const [a1, a2] = [ctx.action(), ctx.action()];
          if (!a1 || !a2) return null;
          const p = ctx.pron();
          return joinClauses(
            clause(rng, ctx, { aspect: "prog", pron: p, ...a1 }),
            clause(rng, ctx, { aspect: "prog", pron: p, ...a2 }),
            { tl: "kahit", en: "even though", tlPos: "initial", enPos: "initial", options: ["kahit", "kung", "dahil"] },
          );
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const p = ctx.pron();
          const c = clause(rng, ctx, { aspect: "prog", pron: p, ...act });
          return S({
            tl: `${bare(c.tl)} pa rin.`,
            en: `${bare(c.en)} anyway.`,
            key: { word: "rin", options: ["rin", "din", "na"] },
            gloss: [{ tl: "pa rin", en: "still / anyway" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const p = ctx.pron();
          const c = clause(rng, ctx, { aspect: "comp", pron: p, ...act });
          return S({
            tl: `Kahit pagod ${p.ang}, ${lower1(bare(c.tl))}.`,
            en: `Even though ${p.en.toLowerCase()} ${p.past} tired, ${lower1(bare(c.en))}.`,
            key: { word: "Kahit", options: ["Kahit", "Dahil", "Kapag"] },
            gloss: [{ tl: "kahit pagod", en: "even though tired" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["kahit", "sandali", "lang", ",", vf(act.verb, "imp"), "ka"]),
            en: enSentence(["even if just for a moment,", act.verb.en.base]),
            key: { word: "sandali", options: ["sandali", "araw", "taon"] },
            gloss: [{ tl: "kahit sandali lang", en: "even just for a moment" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: "Pupunta ka pa rin kahit umuulan?",
          en: "Will you still go even though it is raining?",
          q: true,
          key: { word: "kahit", options: ["kahit", "kung", "dahil"] },
        }),
        a: S({
          tl: "Oo, pupunta pa rin ako.",
          en: "Yes, I will still go.",
          key: { word: "rin", options: ["rin", "din", "na"] },
        }),
      };
    },
  },

  {
    id: "opinions",
    title: "Hedging and opinion",
    tip:
      "Sa palagay ko / sa tingin ko = in my opinion. Siguro (probably), baka " +
      "(maybe) and mukhang (it seems) all soften a claim; mukhang and parang " +
      "take the linker onto whatever follows.",
    lessonTitles: ["Sa tingin ko", "Siguro and baka", "Mukhang…", "Careful claims"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("siya"), ...act });
          return S({
            tl: `Sa tingin ko, ${lower1(bare(c.tl))}.`,
            en: `I think ${lower1(bare(c.en))}.`,
            key: { word: "tingin", options: ["tingin", "palagay", "alam"] },
            gloss: [{ tl: "sa tingin ko", en: "I think" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const hedge = rng.pick(HEDGES.slice(0, 2));
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pron(), ...act });
          return S({
            tl: `${hedge.tl.charAt(0).toUpperCase()}${hedge.tl.slice(1)} ${lower1(bare(c.tl))}.`,
            en: `${hedge.en.charAt(0).toUpperCase()}${hedge.en.slice(1)} ${lower1(bare(c.en))}.`,
            key: { word: hedge.tl.charAt(0).toUpperCase() + hedge.tl.slice(1), options: options(hedge.tl.charAt(0).toUpperCase() + hedge.tl.slice(1), ["Siguro", "Baka", "Talaga"]) },
            gloss: [{ tl: hedge.tl, en: hedge.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "person", "animal"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          return S({
            tl: tlSentence(["mukhang", adj.tl, "ang", noun.tl]),
            en: enSentence(["the", noun.en, "seems", adj.en]),
            key: { word: "mukhang", options: ["mukhang", "parang", "sobrang"] },
            gloss: [{ tl: "mukhang", en: "seems" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Hindi ako sigurado, pero ${lower1(bare(c.tl))}.`,
            en: `I am not sure, but ${lower1(bare(c.en))}.`,
            key: { word: "sigurado", options: ["sigurado", "tiyak", "alam"] },
            gloss: [{ tl: "hindi ako sigurado", en: "I am not sure" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action();
      if (!act) return null;
      return {
        q: S({
          tl: "Ano sa tingin mo ang mangyayari?",
          en: "What do you think will happen?",
          q: true,
          key: { word: "tingin", options: ["tingin", "palagay", "alam"] },
        }),
        a: (() => {
          const c = clause(rng, ctx, { aspect: "cont", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Siguro ${lower1(bare(c.tl))}.`,
            en: `Probably ${lower1(bare(c.en))}.`,
            key: { word: "Siguro", options: ["Siguro", "Baka", "Talaga"] },
          });
        })(),
      };
    },
  },

  {
    id: "emphasis",
    title: "Emphasis and insistence",
    tip:
      "Talaga = really, nga = indeed (and softens a request), naman shifts the " +
      "focus or mildly complains. Doubling an adjective intensifies it: bukas " +
      "na bukas ang palad niya.",
    lessonTitles: ["Talaga", "Nga", "Naman", "Turning up the volume"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "person", "animal"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          return S({
            tl: tlSentence([adj.tl, "talaga", "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is really", adj.en]),
            key: { word: "talaga", options: ["talaga", "naman", "nga"] },
            gloss: [{ tl: "talaga", en: "really" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence([vf(act.verb, "imp"), "ka", "nga", act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence([act.verb.en.base, act.obj ? enNP(act.obj) : null, ", please"]),
            key: { word: "nga", options: ["nga", "naman", "talaga"] },
            gloss: [{ tl: "nga", en: "(softens a request)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action();
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "prog", pron: ctx.pronById("ako"), ...act });
          return S({
            tl: bare(c.tl).replace(/\bako\b/, "naman ako") + ".",
            en: `${bare(c.en)}, for my part.`,
            key: { word: "naman", options: ["naman", "talaga", "nga"] },
            gloss: [{ tl: "naman", en: "for my part / on the other hand" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const noun = ctx.pick(["thing", "food", "drink", "place", "person", "animal"]);
          if (!noun) return null;
          const adj = ctx.adj(noun);
          if (!adj) return null;
          return S({
            tl: tlSentence([adj.tl, "na", adj.tl, "ang", noun.tl]),
            en: enSentence(["the", noun.en, "is very, very", adj.en]),
            key: { word: "na", options: ["na", "pa", "ng"] },
            gloss: [{ tl: `${adj.tl} na ${adj.tl}`, en: `very, very ${adj.en}` }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const noun = ctx.pick(["thing", "food", "drink", "place", "person", "animal"]);
      if (!noun) return null;
      const adj = ctx.adj(noun);
      if (!adj) return null;
      return {
        q: S({
          tl: tlSentence([adj.tl, "ba", "talaga", "ang", noun.tl], { q: true }),
          en: enSentence(["is the", noun.en, "really", adj.en], { q: true }),
          q: true,
          key: { word: "talaga", options: ["talaga", "naman", "nga"] },
        }),
        a: S({
          tl: tlSentence(["oo", ",", adj.tl, "nga"]),
          en: enSentence(["yes, it really is", adj.en]),
          key: { word: "nga", options: ["nga", "naman", "lang"] },
        }),
      };
    },
  },

  {
    id: "news-register",
    title: "News and formal writing",
    tip:
      "Written Tagalog leans on ay, on ayon sa (according to) and on nominalized " +
      "verbs: Ayon sa ulat, nagsimula ang pagtatayo. It sounds stiff in speech " +
      "and exactly right in print.",
    lessonTitles: ["Ayon sa…", "Ang ay-order", "Headlines", "Reading the news"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const act = ctx.action({ wantPlace: true });
          if (!act) return null;
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Ayon sa ulat, ${lower1(bare(c.tl))}.`,
            en: `According to the report, ${lower1(bare(c.en))}.`,
            key: { word: "Ayon", options: ["Ayon", "Sabi", "Balita"] },
            gloss: [{ tl: "ayon sa ulat", en: "according to the report" }],
          });
        },
      },
      {
        needs: ["person"],
        make: (rng, ctx) => {
          const person = ctx.pick(["person"]);
          if (!person) return null;
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence(["ang", person.tl, "ay", vf(act.verb, "comp"), act.obj ? `ng ${act.obj.tl}` : null]),
            en: enSentence(["the", person.en, act.verb.en.past, act.obj ? enNP(act.obj) : null]),
            key: { word: "ay", options: ["ay", "ang", "ng"] },
            gloss: [{ tl: "ay", en: "(formal linker)" }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          const act = ctx.action();
          if (!act) return null;
          return S({
            tl: tlSentence([vf(act.verb, "comp"), "ang", "marami", "sa", place.tl, "kahapon"]),
            en: enSentence(["many people", act.verb.en.past, atThe(place), "yesterday"]),
            key: { word: "marami", options: ["marami", "kaunti", "wala"] },
            gloss: [{ tl: "marami", en: "many" }, { tl: place.tl, en: place.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const place = ctx.place();
          return S({
            tl: tlSentence(["nagsimula", "ang", "pagtatayo", "ng", "bagong", place.tl, "noong", "Lunes"]),
            en: enSentence(["construction of the new", place.en, "began on Monday"]),
            key: { word: "nagsimula", options: ["nagsimula", "nagtatapos", "nagsasara"] },
            gloss: [{ tl: "nagsimula", en: "began" }, { tl: "pagtatayo", en: "construction" }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const act = ctx.action({ wantPlace: true });
      if (!act) return null;
      return {
        q: S({
          tl: "Ano ang nakasulat sa balita?",
          en: "What does the news say?",
          q: true,
          key: { word: "balita", options: ["balita", "ulat", "sulat"] },
        }),
        a: (() => {
          const c = clause(rng, ctx, { aspect: "comp", pron: ctx.pronById("sila"), ...act });
          return S({
            tl: `Ayon sa ulat, ${lower1(bare(c.tl))}.`,
            en: `According to the report, ${lower1(bare(c.en))}.`,
            key: { word: "Ayon", options: ["Ayon", "Sabi", "Balita"] },
          });
        })(),
      };
    },
  },

  {
    id: "figurative",
    title: "Idioms and sayings",
    tip:
      "Most Tagalog idioms are adjective + ang + body part: matigas ang ulo " +
      "(stubborn), mababaw ang luha (cries easily). Learn the pattern and half " +
      "of them decode themselves — but never translate them word for word.",
    lessonTitles: ["Body-part idioms", "In conversation", "Proverbs", "Saying it sideways"],
    makers: [
      {
        needs: [],
        make: (rng, ctx) => {
          const idiom = rng.pick(IDIOMS.filter((x) => x.bp));
          const pron = ctx.pron();
          return S({
            tl: tlSentence([idiom.tl, pron.ng]),
            en: enSentence([pron.en, pron.third ? "is" : pron.be, idiom.en]),
            key: { word: idiom.tl.split(" ")[0], options: options(idiom.tl.split(" ")[0], IDIOMS.map((x) => x.tl.split(" ")[0])) },
            gloss: [{ tl: idiom.tl, en: idiom.en }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const idiom = rng.pick(IDIOMS.filter((x) => x.bp));
          const name = ctx.name();
          return S({
            tl: tlSentence([idiom.tl, "ni", name]),
            en: enSentence([name, "is", idiom.en]),
            key: { word: "ni", options: ["ni", "si", "kay"] },
            gloss: [{ tl: idiom.tl, en: `${idiom.en} (literally: ${idiom.lit})` }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const proverb = rng.pick(PROVERBS);
          return S({
            tl: proverb.tl,
            en: proverb.en,
            key: null,
            gloss: [{ tl: proverb.tl.split(",")[0], en: proverb.en.split(",")[0] }],
          });
        },
      },
      {
        needs: [],
        make: (rng, ctx) => {
          const idiom = rng.pick(IDIOMS.filter((x) => x.bp));
          const name = ctx.name();
          return S({
            tl: tlSentence(["huwag", "kang", "maging", "katulad", "ni", name, ",", idiom.tl, "niya"]),
            en: enSentence(["do not be like", name, ", he is", idiom.en]),
            key: { word: "katulad", options: ["katulad", "kasama", "kaibigan"] },
            gloss: [{ tl: idiom.tl, en: idiom.en }],
          });
        },
      },
    ],
    qa: (rng, ctx) => {
      const idiom = rng.pick(IDIOMS.filter((x) => x.bp));
      const name = ctx.name();
      return {
        q: S({
          tl: `Ano ang ugali ni ${name}?`,
          en: `What is ${name} like?`,
          q: true,
          key: { word: "Ano", options: ["Ano", "Kailan", "Saan"] },
        }),
        a: S({
          tl: tlSentence([idiom.tl, "niya"]),
          en: enSentence([name, "is", idiom.en]),
          key: { word: idiom.tl.split(" ")[0], options: [idiom.tl.split(" ")[0], "mabait", "matalino"] },
          gloss: [{ tl: idiom.tl, en: idiom.en }],
        }),
      };
    },
  },
].map((f) => ({ ...f, tier: "mastery" }));

export { IDIOMS, PROVERBS };

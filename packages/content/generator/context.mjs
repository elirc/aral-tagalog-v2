/**
 * The word-picking context handed to every sentence maker.
 *
 * Its job is to keep a unit *thematic*: the noun slots are filled from the
 * unit's own theme wherever the maker's requirements allow, and only supporting
 * words (places, people, verbs) fall back to the global lexicon.
 */

import {
  ADJECTIVES,
  NOUN_ACTIONS,
  DAYS,
  NAMES,
  NUMBERS,
  PLACES,
  PEOPLE,
  STATES,
  TIMES,
  TRANSITIVE,
  VERB,
  VERBS,
  nounsFor,
  adjectivesFor,
} from "./lexicon.mjs";
import { PRONOUN, PRONOUNS } from "./grammar.mjs";

/** verbs that read fine with no object at all */
/** intransitives safe to combine with any theme place ("tira" is not: you do
 *  not live at a restaurant), reachable by id when a focus wants them */
const NARROW = new Set(["tira", "sundo", "lagay"]);
const INTRANSITIVE = VERBS.filter((v) => !v.obj && !NARROW.has(v.id));
/** things people ride, for the transport frames */
const RIDES = nounsFor("transport").filter((n) => n.cat === "thing");

const CORE_PRON_IDS = ["ako", "ikaw", "siya", "ako", "siya", "kami", "sila"];

export function makeContext(theme, rng) {
  const themeNouns = nounsFor(theme.id);
  const byCat = (cats) => themeNouns.filter((n) => cats.includes(n.cat));
  const themePlaces = byCat(["place"]);
  const themePeople = byCat(["person"]);
  const declared = theme.places ?? [];
  // theme places first, then the declared fallbacks, deduped by Tagalog word
  const placeChoices = [...themePlaces, ...declared].filter(
    (p, i, all) => all.findIndex((q) => q.tl === p.tl) === i,
  );
  if (placeChoices.length === 0) placeChoices.push(...PLACES.slice(0, 6));

  /**
   * Every verb/object pairing this theme allows. A verb with `objIds` only
   * accepts the words on its list — you throw away rubbish, not a table — so
   * pairing up front is what keeps generated sentences sensible.
   */
  const objects = byCat(["food", "drink", "thing"]).filter((n) => !n.proper && !n.noObj);
  const pairs = [];
  for (const verb of TRANSITIVE.filter((verb) => !NARROW.has(verb.id)))
    for (const obj of objects)
      if ((!NOUN_ACTIONS[obj.tl] || NOUN_ACTIONS[obj.tl].includes(verb.id)) &&
          (verb.objIds ? verb.objIds.includes(obj.tl) : verb.obj.includes(obj.cat)))
        pairs.push({ verb, obj });

  const ctx = {
    theme,
    rng,

    /** every noun belonging to this theme */
    themePool: () => themeNouns,

    /** one theme noun of the given categories (null when the theme has none) */
    pick: (cats, { countable = false } = {}) => {
      let pool = byCat(cats);
      if (countable) pool = pool.filter((n) => !n.mass && !n.proper);
      return pool.length ? rng.pick(pool) : null;
    },

    comparisonPair: () => {
      const groups = ["thing", "food", "drink", "animal", "place", "person"]
        .map((cat) => byCat([cat]).filter((noun) => !noun.noObj && !noun.proper))
        .filter((pool) => pool.length >= 2);
      return groups.length ? rng.sample(rng.pick(groups), 2) : [];
    },

    /** n distinct theme nouns of the given categories */
    sample: (cats, n) => rng.sample(byCat(cats), n),

    /**
     * Where this theme happens. Theme nouns that are places win; otherwise the
     * theme's declared `places` list, which exists precisely so a food unit
     * never lands on "many fish at the cinema".
     */
    place: () => rng.pick(placeChoices),
    placePool: () => placeChoices,

    person: () => (themePeople.length ? rng.pick(themePeople) : rng.pick(PEOPLE)),

    adj: (noun, other = noun) => {
      const pool = adjectivesFor(noun.cat ?? noun).filter((adj) => !adj.nounIds || (adj.nounIds.includes(noun.tl) && adj.nounIds.includes(other.tl)));
      return pool.length ? rng.pick(pool) : rng.pick(ADJECTIVES);
    },
    adjPool: (cat) => {
      const pool = adjectivesFor(cat);
      return pool.length >= 3 ? pool : ADJECTIVES;
    },

    state: () => rng.pick(STATES),
    name: () => rng.pick(NAMES),
    number: ({ big = false } = {}) => rng.pick(big ? NUMBERS.slice(9) : NUMBERS.slice(0, 10)),
    numberPool: () => NUMBERS,
    day: () => rng.pick(DAYS),
    dayPool: () => DAYS,
    rideNoun: () => rng.pick(RIDES),

    pron: () => PRONOUN[rng.pick(CORE_PRON_IDS)],
    pronById: (id) => PRONOUN[id],
    pronPool: () => PRONOUNS,

    verbById: (id) => VERB[id],
    time: (aspect) => rng.pick(TIMES.filter((t) => t.aspect === aspect && !t.habitual)) ?? rng.pick(TIMES),
    timeById: (tl) => TIMES.find((t) => t.tl === tl) ?? TIMES[0],
    habitTime: (pos) => {
      const pool = TIMES.filter((t) => t.habitual && t.pos === pos);
      return pool.length ? rng.pick(pool) : TIMES.find((t) => t.habitual);
    },

    /**
     * A verb with a theme-appropriate object (and optionally a place). Returns
     * null only when `needObj` is set and the theme has nothing edible,
     * drinkable or holdable to act on.
     */
    action: ({ needObj = false, wantPlace = false } = {}) => {
      if (pairs.length > 0 && (needObj || rng.chance(0.75))) {
        const { verb, obj } = rng.pick(pairs);
        return { verb, obj, place: wantPlace ? ctx.place() : null };
      }
      if (needObj) return null;
      const verb = rng.pick(INTRANSITIVE);
      const place = wantPlace || verb.locOnly || rng.chance(0.3) ? ctx.place() : null;
      return { verb, obj: null, place };
    },

    /** a verb that has a full object-focus paradigm, with a theme object */
    objectAction: () => {
      const focused = pairs.filter((p) => p.verb.o);
      return focused.length ? rng.pick(focused) : null;
    },
  };

  return ctx;
}

/** does this theme have at least one noun in each required category? */
export function themeSupports(theme, needs) {
  if (!needs || needs.length === 0) return true;
  const pool = nounsFor(theme.id);
  return needs.some((cat) => pool.some((n) => n.cat === cat));
}

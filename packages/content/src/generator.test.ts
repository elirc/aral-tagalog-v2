import { describe, expect, it } from "vitest";
// Generator modules are also directly executable authoring tools.
// @ts-expect-error JavaScript authoring module has no declaration file.
import { comparative, equalityAdjective, superlative } from "../generator/makers.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { reviewValue } from "../generator/review.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { proofreadEnglish, repeatedTemporalClause, invalidNounAction } from "../generator/proofread.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { makeContext } from "../generator/context.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { rngFrom } from "../generator/grammar.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { THEMES } from "../generator/themes.mjs";
// @ts-expect-error JavaScript authoring module has no declaration file.
import { NOUN_ACTIONS } from "../generator/lexicon.mjs";

describe("generated sentence review", () => {
  it("flags concrete invalid object phrases without matching instructions", () => {
    expect(invalidNounAction("Kumukuha ako ng altar.")).toBe(true);
    expect(invalidNounAction("Nililinis ko ang altar.")).toBe(false);
    expect(invalidNounAction("Bumibili siya ng awit.")).toBe(true);
    expect(invalidNounAction("Naghahanap siya ng awit.")).toBe(false);
    expect(invalidNounAction("Keep the words in order.")).toBe(false);
  });
  it.each([
    ["If he will look for a drum, he will buy it.", "If he looks for a drum, he will buy it."],
    ["If we will not arrive, we will call.", "If we do not arrive, we will call."],
    ["She is cries easily.", "She cries easily."],
    ["They are cannot keep a secret.", "They cannot keep a secret."],
    ["There is food at the kitchen.", "There is food in the kitchen."],
  ])("corrects %s", (before, after) => expect(proofreadEnglish(before)).toBe(after));
  it("rejects a repeated temporal clause", () => {
    expect(repeatedTemporalClause("After he arrived, he arrived.")).toBe(true);
    expect(repeatedTemporalClause("After he arrived, he ate.")).toBe(false);
  });
  it("keeps semantic pairings within their permitted categories", () => {
    for (const theme of THEMES) {
      const ctx = makeContext(theme, rngFrom("review-test:" + theme.id));
      for (let i = 0; i < 30; i++) {
        const [a, b] = ctx.comparisonPair();
        if (a && b) expect(a.cat).toBe(b.cat);
        expect(["hinog", "magulang"]).not.toContain(ctx.adj({ tl: "hapunan", cat: "food" }).tl);
        const action = ctx.action();
        expect(["sundo", "lagay"]).not.toContain(action.verb.id);
        if (action.obj) {
          expect(["himig", "tugtog"]).not.toContain(action.obj.tl);
          if (NOUN_ACTIONS[action.obj.tl]) expect(NOUN_ACTIONS[action.obj.tl]).toContain(action.verb.id);
        }
      }
    }
  });
});

describe("reviewed comparison forms", () => {
  it.each([["good", "better", "best"], ["bad", "worse", "worst"], ["far", "farther", "farthest"],
    ["famous", "more famous", "most famous"], ["big", "bigger", "biggest"], ["happy", "happier", "happiest"]])(
    "inflects %s", (word, comparison, maximum) => {
      expect(comparative(word)).toBe(comparison);
      expect(superlative(word)).toBe(maximum);
    });
  it.each([["maganda", "kasingganda"], ["malaki", "kasinglaki"], ["mainit", "kasing-init"],
    ["mahal", "kasingmahal"], ["mura", "kasingmura"]])("uses the root of %s", (word, expected) => {
      expect(equalityAdjective(word)).toBe(expected);
    });
  it("repairs text without changing saved identifiers and is idempotent", () => {
    const original = { id: "kasingmaganda", audio: "kasingmaganda", answer_tl: "Kasingmaganda ng bahay ang paaralan.",
      answer_en: "The school is more good.", accept: ["The school is gooder."] };
    const result = reviewValue(original);
    expect(result).toEqual({ ...original, answer_tl: "Kasingganda ng bahay ang paaralan.",
      answer_en: "The school is better.", accept: ["The school is better."] });
    expect(reviewValue(result)).toEqual(result);
  });
});

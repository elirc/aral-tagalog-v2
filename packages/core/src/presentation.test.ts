import { describe, expect, it } from "vitest";
import { presentationOrder, seededOrder, seededShuffle } from "./presentation";
import type { Exercise } from "./types";

const choice: Exercise = {
  id: "u1-l1-e1",
  type: "choice",
  prompt: "Good morning",
  answer: "Magandang umaga",
  distractors: ["Magandang gabi", "Salamat", "Paalam"],
};

const SALTS = Array.from({ length: 24 }, (_, i) => i);

describe("seededShuffle / seededOrder", () => {
  it("returns the same order for the same seed", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    expect(seededShuffle(items, "seed")).toEqual(seededShuffle(items, "seed"));
    expect(seededOrder(6, 42)).toEqual(seededOrder(6, 42));
  });

  it("returns a permutation and leaves the input untouched", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const copy = [...items];
    const out = seededShuffle(items, "x");
    expect(items).toEqual(copy);
    expect([...out].sort()).toEqual(copy);
    expect([...seededOrder(9, "x")].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("handles empty, single-item and junk lengths", () => {
    expect(seededShuffle([], "x")).toEqual([]);
    expect(seededShuffle(["only"], "x")).toEqual(["only"]);
    expect(seededOrder(0, "x")).toEqual([]);
    expect(seededOrder(-3, "x")).toEqual([]);
    expect(seededOrder(Number.NaN, "x")).toEqual([]);
  });

  it("is pinned to exact output, so web and mobile can never drift apart", () => {
    // If this changes, the algorithm changed: both clients re-lay-out every
    // exercise. Harmless, but it should be a decision, not an accident.
    expect(seededOrder(5, "pin")).toMatchInlineSnapshot(`
      [
        2,
        4,
        1,
        3,
        0,
      ]
    `);
  });
});

describe("presentationOrder", () => {
  it("is stable for one attempt (same exercise, same salt)", () => {
    expect(presentationOrder(choice, 3)).toEqual(presentationOrder(choice, 3));
  });

  it("choice: shows the answer and every distractor exactly once", () => {
    for (const salt of SALTS) {
      const { options } = presentationOrder(choice, salt);
      expect([...options].sort()).toEqual(
        ["Magandang umaga", "Magandang gabi", "Salamat", "Paalam"].sort(),
      );
    }
  });

  it("moves the correct answer between attempts — a retry can't be solved by position", () => {
    // the bug this replaces: a constant seed put the answer in the same slot
    // on every attempt of the same exercise
    const slots = new Set(SALTS.map((s) => presentationOrder(choice, s).options.indexOf("Magandang umaga")));
    expect(slots.size).toBe(4); // every slot is reachable
    const layouts = new Set(SALTS.map((s) => presentationOrder(choice, s).options.join("|")));
    expect(layouts.size).toBeGreaterThan(8);
  });

  it("does not put the answer first by default (salt 0) for every exercise", () => {
    const firsts = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const ex: Exercise = { ...choice, id: `ex-${i}` };
        return presentationOrder(ex).options[0];
      }),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("word bank: a permutation of bank indices, so duplicate words stay distinct tiles", () => {
    const taps: Exercise = {
      id: "t1",
      type: "translate_taps",
      direction: "base_to_target",
      prompt: "day by day",
      answer: "araw araw",
      wordBank: ["araw", "araw", "gabi", "ako", "ikaw"],
    };
    const orders = new Set<string>();
    for (const salt of SALTS) {
      const out = presentationOrder(taps, salt);
      expect([...out.wordBankOrder].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
      expect(out.options).toEqual([]);
      orders.add(out.wordBankOrder.join(","));
    }
    expect(orders.size).toBeGreaterThan(8);

    const listen: Exercise = { id: "h1", type: "listen", audio: "a1", answer: "oo", wordBank: ["oo", "hindi"] };
    expect([...presentationOrder(listen, 1).wordBankOrder].sort()).toEqual([0, 1]);
  });

  it("match_pairs: both columns are complete and shuffled independently", () => {
    const match: Exercise = {
      id: "m1",
      type: "match_pairs",
      pairs: [
        { left: "aso", right: "dog" },
        { left: "pusa", right: "cat" },
        { left: "ibon", right: "bird" },
        { left: "isda", right: "fish" },
      ],
    };
    const rightOf: Record<string, string> = { aso: "dog", pusa: "cat", ibon: "bird", isda: "fish" };
    let aligned = 0;
    for (const salt of SALTS) {
      const { lefts, rights } = presentationOrder(match, salt);
      expect([...lefts].sort()).toEqual(["aso", "ibon", "isda", "pusa"]);
      expect([...rights].sort()).toEqual(["bird", "cat", "dog", "fish"]);
      if (lefts.every((l, i) => rightOf[l] === rights[i])) aligned++;
    }
    // sharing one random stream would line every pair up, answering the exercise
    expect(aligned).toBeLessThan(SALTS.length / 2);
  });

  it("fill_blank: shuffles options, and free-text has none", () => {
    const withOptions: Exercise = {
      id: "f1",
      type: "fill_blank",
      sentence: "___ ako",
      answer: "Kumain",
      options: ["Kumain", "Kain", "Kakain"],
    };
    const layouts = new Set<string>();
    for (const salt of SALTS) {
      const { options } = presentationOrder(withOptions, salt);
      expect([...options].sort()).toEqual(["Kain", "Kakain", "Kumain"]);
      layouts.add(options.join("|"));
    }
    expect(layouts.size).toBeGreaterThan(2);
    // authored order is never mutated
    expect(withOptions.options).toEqual(["Kumain", "Kain", "Kakain"]);

    const freeText: Exercise = { id: "f2", type: "fill_blank", sentence: "___ ako", answer: "Kumain" };
    expect(presentationOrder(freeText, 2).options).toEqual([]);
  });
});

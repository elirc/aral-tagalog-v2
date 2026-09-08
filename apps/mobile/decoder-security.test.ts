import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolve the same dependency chain used by Expo / React Navigation. Testing a
// direct copy alone would miss a missing override or a CommonJS export mismatch.
const mobileRequire = createRequire(import.meta.url);
const routerRequire = createRequire(mobileRequire.resolve("expo-router/package.json"));
const nativeRequire = createRequire(routerRequire.resolve("@react-navigation/native"));
const coreRequire = createRequire(nativeRequire.resolve("@react-navigation/core"));
const queryPath = coreRequire.resolve("query-string");
const queryRequire = createRequire(queryPath);
const decoder = queryRequire("decode-uri-component") as (input: unknown) => string;
const query = coreRequire("query-string") as {
  parse: (input: string, options?: { decode?: boolean }) => Record<string, unknown>;
  stringify: (input: Record<string, unknown>) => string;
};
const fixtures = JSON.parse(readFileSync(
  mobileRequire.resolve("../../vendor/decode-uri-component/test-fixtures.json"),
  "utf8",
)) as { group: string; input: string; expected: string }[];

describe("mobile URI decoder security compatibility", () => {
  it.each(fixtures)("preserves upstream $group case $input", ({ input, expected }) => {
    expect(decoder(input)).toBe(expected);
  });

  it.each([undefined, null, 5, true, {}, [], Symbol("input")])(
    "rejects non-string input %s",
    (input) => expect(() => decoder(input)).toThrow(TypeError),
  );

  it("preserves route query parameters, plus signs, Unicode, arrays, and empty values", () => {
    const parameters = {
      lesson: "pagkain",
      text: "Kumain ka na? \uD83D\uDE00",
      tag: ["one", "two"],
      empty: "",
      flag: null,
      plus: "+",
    };
    expect(query.parse(query.stringify(parameters))).toEqual(parameters);
    expect(query.parse("foo+bar=a+b&literal=%2B&mixed=%C3%A5%ab")).toEqual({
      "foo bar": "a b",
      literal: "+",
      mixed: "\u00E5%ab",
    });
    expect(query.parse("foo+bar=a+b", { decode: false })).toEqual({ "foo+bar": "a+b" });
  });

  it("decodes only one percent-encoding layer and preserves malformed UTF-8", () => {
    expect(query.parse("value=%2525&broken=%F0%9F%41&percent=%84%D7%25%88%90")).toEqual({
      value: "%25",
      broken: "%F0%9FA",
      percent: "%84%D7%%88%90",
    });
  });

  it("handles long malicious percent sequences without blocking the app", () => {
    // A subprocess timeout also stops a future synchronous decoder regression;
    // Vitest's normal async test timeout cannot interrupt a CPU-bound parser.
    const script = `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const query = require(process.argv[1]);
      const decode = createRequire(process.argv[1])('decode-uri-component');
      for (const sequence of ['%ab', '%C3%41', '%F0%9F%41']) {
        const input = sequence.repeat(20000);
        const expected = { '%ab': '%ab', '%C3%41': '%C3A', '%F0%9F%41': '%F0%9FA' }[sequence].repeat(20000);
        assert.equal(decode(input), expected);
        assert.equal(query.parse('value=' + input).value, expected);
      }
      process.stdout.write('decoded');
    `;
    expect(execFileSync(process.execPath, ["-e", script, queryPath], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 4_096,
      windowsHide: true,
    })).toBe("decoded");
  }, 10_000);
});

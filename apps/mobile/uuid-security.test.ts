import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const mobileRequire = createRequire(import.meta.url);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const pluginsRequire = createRequire(expoRequire.resolve("@expo/config-plugins"));
const xcodePath = pluginsRequire.resolve("xcode");
const xcodeRequire = createRequire(xcodePath);
const uuid = xcodeRequire("uuid") as {
  v4: () => string;
  v5: (name: string, namespace: string, buffer: Uint8Array, offset: number) => Uint8Array;
};
const xcode = pluginsRequire("xcode") as {
  project: (filename: string) => {
    hash: { project: { objects: Record<string, Record<string, unknown>> } };
    generateUuid: () => string;
  };
};

describe("Expo Xcode UUID dependency compatibility", () => {
  it("keeps CommonJS UUID generation available to the Xcode project writer", () => {
    expect(uuid.v4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const project = xcode.project("unused.pbxproj");
    const group: Record<string, unknown> = {};
    project.hash = { project: { objects: { PBXGroup: group } } };
    const generated = new Set<string>();
    for (let index = 0; index < 128; index++) {
      const id = project.generateUuid();
      expect(id).toMatch(/^[0-9A-F]{24}$/);
      expect(generated.has(id)).toBe(false);
      generated.add(id);
      group[id] = {};
    }
  });

  it("rejects an undersized caller buffer without partially overwriting it", () => {
    const output = new Uint8Array(8).fill(0xaa);
    expect(() => uuid.v5("aral", "6ba7b810-9dad-11d1-80b4-00c04fd430c8", output, 4)).toThrow(RangeError);
    expect([...output]).toEqual(Array(8).fill(0xaa));
  });
});

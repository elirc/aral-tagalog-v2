import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCatalog } from "./catalog";

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "aral-catalog-"));
  directories.push(directory);
  writeFileSync(join(directory, "manifest.json"), JSON.stringify({ courseId: "en-tl", version: 1, bundle: "course_en_tl_v1.json" }));
  writeFileSync(join(directory, "course_en_tl_v1.json"), JSON.stringify({
    id: "en-tl", version: 1, units: [{ lessons: [{ id: "hello", xp: 10, exercises: [{}] }] }],
  }));
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("release content catalog", () => {
  it("uses the versioned bundle named in the manifest", () => {
    const catalog = readCatalog(fixture());
    expect(catalog.maxAuthoredXp).toBe(15);
    expect([...catalog.lessonById.keys()]).toEqual(["hello"]);
  });

  it("rejects missing artifacts and truncated JSON", () => {
    const directory = fixture();
    writeFileSync(join(directory, "course_en_tl_v1.json"), "{");
    expect(() => readCatalog(directory)).toThrow();
    expect(() => readCatalog(join(directory, "missing"))).toThrow();
  });

  it("rejects empty or mismatched bundles", () => {
    const directory = fixture();
    writeFileSync(join(directory, "course_en_tl_v1.json"), JSON.stringify({ id: "en-tl", version: 1, units: [] }));
    expect(() => readCatalog(directory)).toThrow();
    const other = fixture();
    const path = join(other, "course_en_tl_v1.json");
    const bundle = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify({ ...bundle, version: 2 }));
    expect(() => readCatalog(other)).toThrow("versions differ");
  });

  it("does not follow a path from an invalid manifest", () => {
    const directory = fixture();
    writeFileSync(join(directory, "manifest.json"), JSON.stringify({ courseId: "en-tl", version: 1, bundle: "../secret.json" }));
    expect(() => readCatalog(directory)).toThrow();
  });
});

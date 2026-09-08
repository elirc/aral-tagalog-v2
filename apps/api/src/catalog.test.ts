import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCatalog } from "./catalog";

const directories: string[] = [];
function fixture(lessons: unknown[] = [{ id: "hello", xp: 10, exerciseCount: 1 }]) {
  const directory = mkdtempSync(join(tmpdir(), "aral-catalog-"));
  directories.push(directory);
  writeFileSync(join(directory, "manifest.json"), JSON.stringify({ courseId: "en-tl", version: 1, bundle: "course_en_tl_v1.json" }));
  writeFileSync(join(directory, "sync_catalog.json"), JSON.stringify({ id: "en-tl", version: 1, lessons }));
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("release content catalog", () => {
  it("loads the compact catalog without opening a full course bundle", () => {
    // No full bundle exists: a serverless function needs only these two files.
    const catalog = readCatalog(fixture());
    expect(catalog.maxAuthoredXp).toBe(15);
    expect([...catalog.lessonById.keys()]).toEqual(["hello"]);
    expect(catalog.lessonById.get("hello")).toEqual({ id: "hello", xp: 10, exerciseCount: 1 });
  });

  it("keeps existing default XP semantics and computes the maximum across lessons", () => {
    const catalog = readCatalog(fixture([
      { id: "default", exerciseCount: 1 },
      { id: "zero", xp: 0, exerciseCount: 2 },
      { id: "advanced", xp: 95, exerciseCount: 12 },
    ]));
    expect(catalog.maxAuthoredXp).toBe(100);
    expect(catalog.lessonById.get("default")?.xp).toBe(0);
    expect(readCatalog(fixture([{ id: "zero", xp: 0, exerciseCount: 1 }])).maxAuthoredXp).toBe(15);
  });

  it("does not retain unrelated payload fields", () => {
    const catalog = readCatalog(fixture([{ id: "hello", xp: 10, exerciseCount: 1, exercises: [{ answer: "hello" }] }]));
    expect(catalog.lessonById.get("hello")).toEqual({ id: "hello", xp: 10, exerciseCount: 1 });
  });

  it("rejects missing artifacts and truncated JSON", () => {
    const directory = fixture();
    writeFileSync(join(directory, "sync_catalog.json"), "{");
    expect(() => readCatalog(directory)).toThrow();
    expect(() => readCatalog(join(directory, "missing"))).toThrow();
  });

  it("requires the compact artifact even when a legacy full bundle exists", () => {
    const directory = fixture();
    rmSync(join(directory, "sync_catalog.json"));
    writeFileSync(join(directory, "course_en_tl_v1.json"), JSON.stringify({
      id: "en-tl", version: 1, units: [{ lessons: [{ id: "hello", xp: 10, exercises: [{}] }] }],
    }));
    expect(() => readCatalog(directory)).toThrow();
  });

  it("rejects empty or mismatched catalogs", () => {
    expect(() => readCatalog(fixture([]))).toThrow();
    const directory = fixture();
    const path = join(directory, "sync_catalog.json");
    const compact = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify({ ...compact, version: 2 }));
    expect(() => readCatalog(directory)).toThrow("versions differ");
    writeFileSync(path, JSON.stringify({ ...compact, id: "other-course" }));
    expect(() => readCatalog(directory)).toThrow();
  });

  it("rejects duplicate lesson ids", () => {
    const directory = fixture([
      { id: "duplicate", xp: 10, exerciseCount: 1 },
      { id: "duplicate", xp: 20, exerciseCount: 2 },
    ]);
    expect(() => readCatalog(directory)).toThrow("duplicate lesson ids");
  });

  it.each([
    { id: "", xp: 10, exerciseCount: 1 },
    { id: "lesson", xp: -1, exerciseCount: 1 },
    { id: "lesson", xp: "10", exerciseCount: 1 },
    { id: "lesson", xp: 10, exerciseCount: 0 },
    { id: "lesson", xp: 10, exerciseCount: -1 },
    { id: "lesson", xp: 10, exerciseCount: 1.5 },
    { id: "lesson", xp: 10 },
  ])("rejects invalid authored validation data: %j", (lesson) => {
    expect(() => readCatalog(fixture([lesson]))).toThrow();
  });

  it("does not accept a path or mismatched version in the manifest", () => {
    const directory = fixture();
    for (const bundle of ["../secret.json", "course_en_tl_v2.json"]) {
      writeFileSync(join(directory, "manifest.json"), JSON.stringify({ courseId: "en-tl", version: 1, bundle }));
      expect(() => readCatalog(directory)).toThrow();
    }
  });
});

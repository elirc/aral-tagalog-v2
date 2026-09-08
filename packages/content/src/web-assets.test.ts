import { describe, expect, it } from "vitest";
import { exercisePartition, type CourseBundle, type WebUnitContent } from "@aral/core";
import { buildSyncCatalog, buildWebAssets } from "./web-assets";

const bundle: CourseBundle = {
  id: "en-tl", version: 7, baseLang: "en", targetLang: "tl", title: "Test course",
  units: [{ id: "u1", title: "Greetings", tip: "A tip", lessons: [{
    id: "l1", title: "Hello", xp: 10,
    exercises: [{ id: "custom-id", type: "choice", prompt: "Choose", answer: "Canonical answer", distractors: ["Other"], audio: "hello" }],
  }] }, { id: "u2", title: "Next", lessons: [{ id: "l2", title: "Next lesson", xp: 20, exercises: [{ id: "l2-ex1", type: "match_pairs", pairs: [{ left: "a", right: "b" }] }] }] }],
  vocab: { hello: { id: "hello", lemma: "Kumusta", translation: "Hello", audio: "greeting" } },
  audio: { hello: "audio/hello.mp3", greeting: "audio/greeting.mp3", unused: "audio/unused.mp3" },
  audioTexts: { hello: "Kumusta", unused: "Unused text" },
};

describe("split content artifacts", () => {
  it("keeps exercises out of browsing data and round-trips every lesson in its unit", () => {
    const { index, files } = buildWebAssets(bundle);
    expect(JSON.stringify(index)).not.toContain("Canonical answer");
    expect(index.units[0]!.lessons[0]).toEqual({ id: "l1", title: "Hello", xp: 10 });
    index.units.forEach((unit, i) => {
      const payload = JSON.parse(files.get(unit.file)!) as WebUnitContent;
      expect(payload.unit).toEqual(bundle.units[i]);
      expect(payload.version).toBe(bundle.version);
    });
    const unit = JSON.parse(files.get(index.units[0]!.file)!);
    expect(unit.audio).toEqual({ hello: "audio/hello.mp3" });
    expect(unit.audioTexts).toEqual({ hello: "Kumusta" });
    const vocab = JSON.parse(files.get(index.vocabFile)!);
    expect(vocab.vocab).toEqual(bundle.vocab);
    expect(vocab.audio).toEqual({ greeting: "audio/greeting.mp3" });
  });

  it("indexes arbitrary exercise IDs without assuming lesson ID prefixes", () => {
    const { index, files } = buildWebAssets(bundle);
    bundle.units.forEach((unit, unitIndex) => unit.lessons.forEach((lesson) => lesson.exercises.forEach((exercise) => {
      const lookup = JSON.parse(files.get(index.reviewFiles[exercisePartition(exercise.id)]!)!);
      expect(lookup.unitsByExercise[exercise.id]).toBe(unitIndex);
    })));
  });

  it("uses deterministic content hashes and changes the affected URL when content changes", () => {
    const first = buildWebAssets(bundle);
    expect(buildWebAssets(bundle)).toEqual(first);
    const updated = structuredClone(bundle);
    updated.units[0]!.lessons[0]!.title = "New title";
    const second = buildWebAssets(updated);
    expect(second.index.units[0]!.file).not.toBe(first.index.units[0]!.file);
    expect(second.index.units[1]!.file).toBe(first.index.units[1]!.file);
    expect(second.index.vocabFile).toBe(first.index.vocabFile);
    for (const name of first.files.keys()) expect(name).toMatch(/^(unit|vocab|review)-[a-f0-9]{20}\.json$/);
  });

  it("emits only the fields the API needs to cap rewards", () => {
    expect(buildSyncCatalog(bundle)).toEqual({ id: "en-tl", version: 7, lessons: [
      { id: "l1", xp: 10, exerciseCount: 1 }, { id: "l2", xp: 20, exerciseCount: 1 },
    ] });
  });
});

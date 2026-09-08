import { describe, expect, it, vi } from "vitest";
import { exercisePartition, type WebCourseIndex, type WebUnitContent } from "@aral/core";
import { CourseContentLoader } from "./content-loader";

function fixture() {
  const unitFile = "unit-00000000000000000001.json";
  const vocabFile = "vocab-00000000000000000001.json";
  const reviewFiles = Array.from({ length: 64 }, (_, i) => `review-${i.toString(16).padStart(20, "0")}.json`);
  const content: WebUnitContent = {
    courseId: "en-tl", version: 1,
    unit: { id: "unit1", title: "Unit", lessons: [{ id: "lesson1", title: "Lesson", xp: 10,
      exercises: Array.from({ length: 12 }, (_, i) => ({ id: `exercise-${i}`, type: "choice", prompt: "Pick", answer: "yes", distractors: ["no"], audio: "hello" })),
    }] }, audio: { hello: "audio/hello.mp3" }, audioTexts: { hello: "Kumusta" },
  };
  const index: WebCourseIndex = { id: "en-tl", version: 1, title: "Course", baseLang: "en", targetLang: "tl",
    units: [{ id: "unit1", title: "Unit", file: unitFile, lessons: [{ id: "lesson1", title: "Lesson", xp: 10 }] }],
    vocabFile, reviewFiles,
  };
  const files = new Map<string, unknown>([
    [unitFile, content],
    [vocabFile, { courseId: "en-tl", version: 1, vocab: { hello: { id: "hello", lemma: "Kumusta", translation: "Hello" } }, audio: {} }],
  ]);
  reviewFiles.forEach((file, partition) => files.set(file, { courseId: "en-tl", version: 1,
    unitsByExercise: Object.fromEntries(content.unit.lessons[0]!.exercises.filter((ex) => exercisePartition(ex.id) === partition).map((ex) => [ex.id, 0])),
  }));
  const fetchJson = vi.fn(async (path: string) => {
    const data = files.get(path.replace("/_course/web/", ""));
    if (!data) throw new Error("Missing file");
    return structuredClone(data);
  });
  return { index, content, files, fetchJson, loader: new CourseContentLoader(index, fetchJson) };
}

describe("on-demand course content", () => {
  it("browses metadata and rejects unknown lessons without a download", async () => {
    const { loader, fetchJson } = fixture();
    expect(loader.findLesson("lesson1")?.unitTitle).toBe("Unit");
    expect(await loader.loadLesson("missing")).toBeNull();
    expect(await loader.loadReview([])).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("coalesces concurrent unit requests and loads audio with the lesson", async () => {
    const { loader, fetchJson, content } = fixture();
    const [a, b] = await Promise.all([loader.loadLesson("lesson1"), loader.loadLesson("lesson1")]);
    expect(a).toEqual(content.unit.lessons[0]); expect(b).toBe(a);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(loader.audioFor("hello")).toEqual({ file: "audio/hello.mp3", text: "Kumusta" });
  });

  it("retries failed downloads instead of caching the rejection", async () => {
    const { loader, fetchJson } = fixture();
    fetchJson.mockRejectedValueOnce(new Error("Offline"));
    await expect(loader.loadLesson("lesson1")).rejects.toThrow("Offline");
    expect(await loader.loadLesson("lesson1")).not.toBeNull();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("refuses mismatched versions and can recover on retry", async () => {
    const { loader, content } = fixture();
    content.version = 99;
    await expect(loader.loadLesson("lesson1")).rejects.toThrow("version");
    content.version = 1;
    expect(await loader.loadLesson("lesson1")).not.toBeNull();
  });

  it("does not retain malformed unit payloads after a retry", async () => {
    const { loader, content, fetchJson } = fixture();
    const exercises = content.unit.lessons[0]!.exercises;
    content.unit.lessons[0]!.exercises = [];
    await expect(loader.loadLesson("lesson1")).rejects.toThrow("Invalid lesson");
    content.unit.lessons[0]!.exercises = exercises;
    expect(await loader.loadLesson("lesson1")).not.toBeNull();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("preserves oldest-first review order, skips stale IDs, deduplicates and caps at ten", async () => {
    const { loader, fetchJson } = fixture();
    const weak = ["removed", "exercise-11", "exercise-11", ...Array.from({ length: 11 }, (_, i) => `exercise-${i}`)];
    const review = await loader.loadReview(weak);
    expect(review?.id).toBe("review"); expect(review?.xp).toBe(5);
    expect(review?.exercises.map((ex) => ex.id)).toEqual(["exercise-11", ...Array.from({ length: 9 }, (_, i) => `exercise-${i}`)]);
    expect(fetchJson.mock.calls.filter(([path]) => path.includes("/unit-")).length).toBe(1);
  });

  it("loads vocabulary separately and retries its failures", async () => {
    const { loader, fetchJson } = fixture();
    fetchJson.mockRejectedValueOnce(new Error("Offline"));
    await expect(loader.loadVocabulary()).rejects.toThrow("Offline");
    expect(Object.keys((await loader.loadVocabulary()).vocab)).toEqual(["hello"]);
    await loader.loadVocabulary();
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(fetchJson.mock.calls.every(([path]) => path.includes("/vocab-"))).toBe(true);
  });

  it("restores cached review audio after the bounded audio cache has evicted it", async () => {
    const { loader, files, index } = fixture();
    const vocab = files.get(index.vocabFile) as { audio: Record<string, string> };
    vocab.audio = Object.fromEntries(Array.from({ length: 4100 }, (_, i) => ["vocab-" + i, "audio/vocab_" + i + ".mp3"]));
    await loader.loadLesson("lesson1");
    await loader.loadVocabulary();
    expect(loader.audioFor("hello")).toBeUndefined();
    await loader.loadReview(["exercise-0"]);
    expect(loader.audioFor("hello")).toEqual({ file: "audio/hello.mp3", text: "Kumusta" });
  });

  it("restores cached phrasebook audio without downloading vocabulary again", async () => {
    const { loader, files, index, content, fetchJson } = fixture();
    const vocab = files.get(index.vocabFile) as { audio: Record<string, string> };
    vocab.audio = { phrase: "audio/phrase.mp3" };
    content.audio = Object.fromEntries(Array.from({ length: 4100 }, (_, i) => ["lesson-" + i, "audio/lesson_" + i + ".mp3"]));
    await loader.loadVocabulary();
    await loader.loadLesson("lesson1");
    expect(loader.audioFor("phrase")).toBeUndefined();
    await loader.loadVocabulary();
    expect(loader.audioFor("phrase")?.file).toBe("audio/phrase.mp3");
    expect(fetchJson.mock.calls.filter(([path]) => path.includes("/vocab-")).length).toBe(1);
  });

  it("blocks unexpected filenames before requesting them", async () => {
    const { index, fetchJson } = fixture(); index.units[0]!.file = "../secrets.json";
    await expect(new CourseContentLoader(index, fetchJson).loadLesson("lesson1")).rejects.toThrow("Invalid content file");
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

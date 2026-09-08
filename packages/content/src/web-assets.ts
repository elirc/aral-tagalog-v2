import { createHash } from "node:crypto";
import type { CourseBundle, WebCourseIndex, WebUnitContent, WebVocabContent, WebReviewIndex } from "@aral/core";
import { exercisePartition, REVIEW_INDEX_PARTITIONS } from "@aral/core";

/** Pure projection apart from hashing: no file writes or compiler entry-point side effects. */
export function buildWebAssets(bundle: CourseBundle): { index: WebCourseIndex; files: Map<string, string> } {
  const files = new Map<string, string>();
  const add = (kind: string, value: unknown) => {
    const json = JSON.stringify(value);
    const hash = createHash("sha256").update(json).digest("hex").slice(0, 20);
    const file = `${kind}-${hash}.json`;
    files.set(file, json);
    return file;
  };
  const reviews: WebReviewIndex[] = Array.from({ length: REVIEW_INDEX_PARTITIONS }, () => ({
    courseId: bundle.id, version: bundle.version, unitsByExercise: Object.create(null) as Record<string, number>,
  }));
  const units = bundle.units.map((unit, unitIndex) => {
    const refs = new Set<string>();
    for (const lesson of unit.lessons) for (const exercise of lesson.exercises) {
      reviews[exercisePartition(exercise.id)]!.unitsByExercise[exercise.id] = unitIndex;
      if (exercise.audio) refs.add(exercise.audio);
    }
    const audio = Object.fromEntries([...refs].filter((ref) => Object.hasOwn(bundle.audio, ref)).map((ref) => [ref, bundle.audio[ref]!]));
    const audioTexts = Object.fromEntries([...refs].map((ref) => [ref, bundle.audioTexts?.[ref] ?? null]));
    const payload: WebUnitContent = { courseId: bundle.id, version: bundle.version, unit, audio, audioTexts };
    return {
      id: unit.id, title: unit.title, tier: unit.tier, description: unit.description, tip: unit.tip,
      lessons: unit.lessons.map(({ id, title, xp }) => ({ id, title, xp })),
      file: add("unit", payload),
    };
  });
  const vocabRefs = new Set(Object.values(bundle.vocab).map((entry) => entry.audio).filter((ref): ref is string => Boolean(ref)));
  const vocab: WebVocabContent = {
    courseId: bundle.id, version: bundle.version, vocab: bundle.vocab,
    audio: Object.fromEntries([...vocabRefs].filter((ref) => Object.hasOwn(bundle.audio, ref)).map((ref) => [ref, bundle.audio[ref]!])),
  };
  return {
    index: {
      id: bundle.id, version: bundle.version, title: bundle.title, baseLang: bundle.baseLang, targetLang: bundle.targetLang,
      tiers: bundle.tiers, units, vocabFile: add("vocab", vocab), reviewFiles: reviews.map((review) => add("review", review)),
    },
    files,
  };
}

/** The API validates rewards without parsing or retaining exercise bodies. */
export function buildSyncCatalog(bundle: CourseBundle) {
  return {
    id: bundle.id, version: bundle.version,
    lessons: bundle.units.flatMap((unit) => unit.lessons.map((lesson) => ({
      id: lesson.id, xp: lesson.xp, exerciseCount: lesson.exercises.length,
    }))),
  };
}

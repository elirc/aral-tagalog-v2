import {
  exercisePartition, REVIEW_LESSON_ID, REVIEW_MAX_EXERCISES, PRACTICE_XP,
  type Lesson, type WebCourseIndex, type WebUnitContent, type WebVocabContent, type WebReviewIndex,
} from "@aral/core";

type FetchJson = (path: string) => Promise<unknown>;

export async function fetchContentJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error("Could not load this content. Please retry.");
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Content took too long to load. Please retry.");
    throw error;
  } finally { clearTimeout(timer); }
}

/** Public content only: no account state, progress or answers from the learner. */
export class CourseContentLoader {
  private readonly lessons = new Map<string, { unitIndex: number; lessonIndex: number }>();
  private readonly units = new Map<number, Promise<WebUnitContent>>();
  private readonly reviews = new Map<number, Promise<WebReviewIndex>>();
  private vocab: Promise<WebVocabContent> | null = null;
  private readonly audio = new Map<string, { file?: string; text?: string | null }>();

  constructor(readonly index: WebCourseIndex, private readonly fetchJson: FetchJson = fetchContentJson) {
    index.units.forEach((unit, unitIndex) => unit.lessons.forEach((lesson, lessonIndex) => {
      this.lessons.set(lesson.id, { unitIndex, lessonIndex });
    }));
  }

  findLesson(id: string) {
    const position = this.lessons.get(id);
    if (!position) return null;
    const unit = this.index.units[position.unitIndex]!;
    return { lesson: unit.lessons[position.lessonIndex]!, unitTitle: unit.title, unitId: unit.id };
  }

  private async read<T extends { courseId: string; version: number }>(file: string): Promise<T> {
    if (!/^(unit|vocab|review)-[a-f0-9]{20}\.json$/.test(file)) throw new Error("Invalid content file.");
    const value = await this.fetchJson(`/_course/web/${file}`) as T | null;
    if (!value || value.courseId !== this.index.id || value.version !== this.index.version)
      throw new Error("This content version is unavailable. Reload the app and retry.");
    return value;
  }

  private rememberAudio(audio: Record<string, string>, texts: Record<string, string | null> = {}) {
    for (const ref of new Set([...Object.keys(audio), ...Object.keys(texts)])) {
      this.audio.delete(ref);
      this.audio.set(ref, { file: audio[ref], text: texts[ref] });
    }
    // Enough for many lessons; don't rebuild a whole-course audio map after long sessions.
    while (this.audio.size > 4096) this.audio.delete(this.audio.keys().next().value!);
  }

  private loadUnit(unitIndex: number): Promise<WebUnitContent> {
    const cached = this.units.get(unitIndex);
    if (cached) return cached.then((value) => { this.rememberAudio(value.audio, value.audioTexts); return value; });
    const summary = this.index.units[unitIndex];
    if (!summary) return Promise.reject(new Error("Unit not found."));
    const pending = this.read<WebUnitContent>(summary.file).then((value) => {
      if (value.unit?.id !== summary.id || !Array.isArray(value.unit.lessons) || !value.audio || !value.audioTexts)
        throw new Error("Invalid lesson content. Please retry.");
      if (value.unit.lessons.length !== summary.lessons.length || value.unit.lessons.some((lesson, i) =>
        lesson.id !== summary.lessons[i]?.id || !Array.isArray(lesson.exercises) || lesson.exercises.length === 0))
        throw new Error("Invalid lesson content. Please retry.");
      this.rememberAudio(value.audio, value.audioTexts);
      return value;
    });
    this.units.set(unitIndex, pending);
    // Failed responses are never sticky: Retry must actually make a new request.
    void pending.catch(() => { if (this.units.get(unitIndex) === pending) this.units.delete(unitIndex); });
    while (this.units.size > 20) this.units.delete(this.units.keys().next().value!);
    return pending;
  }

  async loadLesson(id: string): Promise<Lesson | null> {
    const position = this.lessons.get(id);
    if (!position) return null;
    const content = await this.loadUnit(position.unitIndex);
    const lesson = content.unit.lessons[position.lessonIndex];
    if (!lesson || lesson.id !== id || !Array.isArray(lesson.exercises) || lesson.exercises.length === 0)
      throw new Error("Lesson content is unavailable. Please retry.");
    this.rememberAudio(content.audio, content.audioTexts);
    return lesson;
  }

  loadVocabulary(): Promise<WebVocabContent> {
    if (!this.vocab) {
      const pending = this.read<WebVocabContent>(this.index.vocabFile).then((value) => {
        if (!value.vocab || Array.isArray(value.vocab) || !value.audio) throw new Error("Invalid phrasebook content.");
        this.rememberAudio(value.audio);
        return value;
      });
      this.vocab = pending;
      void pending.catch(() => { if (this.vocab === pending) this.vocab = null; });
    }
    return this.vocab.then((value) => { this.rememberAudio(value.audio); return value; });
  }

  private loadReviewIndex(partition: number): Promise<WebReviewIndex> {
    const cached = this.reviews.get(partition);
    if (cached) return cached;
    const file = this.index.reviewFiles[partition];
    if (!file) return Promise.reject(new Error("Review index is unavailable."));
    const pending = this.read<WebReviewIndex>(file).then((value) => {
      if (!value.unitsByExercise || Array.isArray(value.unitsByExercise)) throw new Error("Invalid review index.");
      return value;
    });
    this.reviews.set(partition, pending);
    void pending.catch(() => { if (this.reviews.get(partition) === pending) this.reviews.delete(partition); });
    return pending;
  }

  async loadReview(weakIds: string[]): Promise<Lesson | null> {
    const ids = [...new Set(weakIds)];
    const exercises: Lesson["exercises"] = [];
    // Windows of ten bound concurrent reads and stop once the short session is full.
    for (let offset = 0; offset < ids.length && exercises.length < REVIEW_MAX_EXERCISES; offset += REVIEW_MAX_EXERCISES) {
      const window = ids.slice(offset, offset + REVIEW_MAX_EXERCISES);
      const found = await Promise.all(window.map(async (id) => {
        const lookup = await this.loadReviewIndex(exercisePartition(id));
        if (!Object.hasOwn(lookup.unitsByExercise, id)) return null;
        const unitIndex = lookup.unitsByExercise[id];
        if (!Number.isInteger(unitIndex) || unitIndex! < 0 || unitIndex! >= this.index.units.length) return null;
        const content = await this.loadUnit(unitIndex!);
        return content.unit.lessons.flatMap((lesson) => lesson.exercises).find((exercise) => exercise.id === id) ?? null;
      }));
      for (const exercise of found) if (exercise && exercises.length < REVIEW_MAX_EXERCISES) exercises.push(exercise);
    }
    return exercises.length ? { id: REVIEW_LESSON_ID, title: "Review mistakes", xp: PRACTICE_XP, exercises } : null;
  }

  audioFor(ref: string) { return this.audio.get(ref); }
}

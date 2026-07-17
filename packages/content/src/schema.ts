import { z } from "zod";

/**
 * Authoring schema for YAML course files. This is deliberately looser and
 * friendlier than the compiled CourseBundle types in @aral/core — the
 * compiler (compile.ts) transforms authoring shapes into runtime shapes.
 */

export const gradingFlagsSchema = z
  .object({
    ng_nang: z.boolean().optional(),
    hyphens: z.boolean().optional(),
  })
  .strict();

const base = {
  id: z.string().optional(), // auto-assigned "<lessonId>-ex<N>" when omitted
  audio: z.string().optional(),
  /**
   * What the clip says, in the target language. Only needed where the compiler
   * can't infer it — notably `choice`, whose answer may be in either language.
   * Feeds the TTS fallback and scripts/generate-audio (AUD-02).
   */
  audio_text: z.string().optional(),
  hint: z.string().optional(),
};

export const choiceSchema = z
  .object({
    ...base,
    type: z.literal("choice"),
    prompt: z.string(),
    answer: z.string(),
    distractors: z.array(z.string()).min(1),
  })
  .strict();

/**
 * translate: direction is inferred from which fields are present —
 * prompt_tl/answer_en (understand Tagalog) or prompt_en/answer_tl (produce it).
 * word_bank defaults to the answer's words plus extra_words, shuffled
 * deterministically.
 */
export const translateSchema = z
  .object({
    ...base,
    type: z.literal("translate"),
    prompt_tl: z.string().optional(),
    answer_en: z.string().optional(),
    prompt_en: z.string().optional(),
    answer_tl: z.string().optional(),
    accept: z.array(z.string()).optional(),
    word_bank: z.array(z.string()).optional(),
    extra_words: z.array(z.string()).optional(),
    grading: gradingFlagsSchema.optional(),
  })
  .strict();

/** zod discriminatedUnion can't hold refined members, so this runs in the compiler */
export function assertTranslateDirection(e: z.infer<typeof translateSchema>, where: string) {
  const toBase = Boolean(e.prompt_tl && e.answer_en && !e.prompt_en && !e.answer_tl);
  const toTarget = Boolean(e.prompt_en && e.answer_tl && !e.prompt_tl && !e.answer_en);
  if (!toBase && !toTarget)
    throw new Error(`${where}: translate needs exactly one of prompt_tl+answer_en or prompt_en+answer_tl`);
}

export const listenSchema = z
  .object({
    ...base,
    type: z.literal("listen"),
    audio: z.string(), // required: this is an audio exercise
    answer_tl: z.string(),
    accept: z.array(z.string()).optional(),
    word_bank: z.array(z.string()).optional(),
    extra_words: z.array(z.string()).optional(),
    grading: gradingFlagsSchema.optional(),
  })
  .strict();

export const matchSchema = z
  .object({
    ...base,
    type: z.literal("match"),
    pairs: z.array(z.object({ tl: z.string(), en: z.string() }).strict()).min(2),
  })
  .strict();

export const fillBlankSchema = z
  .object({
    ...base,
    type: z.literal("fill_blank"),
    sentence: z.string().refine((s) => s.includes("___"), { message: "sentence must contain ___" }),
    translation: z.string().optional(),
    answer: z.string(),
    options: z.array(z.string()).optional(),
    accept: z.array(z.string()).optional(),
    grading: gradingFlagsSchema.optional(),
  })
  .strict();

export const exerciseSchema = z.discriminatedUnion("type", [
  choiceSchema,
  translateSchema,
  listenSchema,
  matchSchema,
  fillBlankSchema,
]);

export const lessonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    // ≤95: /sync caps per-event xp at 100 and a perfect run adds +5 (core
    // PERFECT_BONUS_XP) — a bigger authored value would produce events the
    // server rejects
    xp: z.number().int().positive().max(95).default(10),
    exercises: z.array(exerciseSchema).min(1),
  })
  .strict();

export const unitSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    tip: z.string().optional(),
    lessons: z.array(lessonSchema).min(1),
  })
  .strict();

export const courseMetaSchema = z
  .object({
    id: z.string(), // "en-tl"
    base_lang: z.string(),
    target_lang: z.string(),
    version: z.number().int().positive(),
    title: z.string(),
  })
  .strict();

export const vocabFileSchema = z.array(
  z
    .object({
      id: z.string(),
      lemma: z.string(),
      translation: z.string(),
      audio: z.string().optional(),
      notes: z.string().optional(),
    })
    .strict(),
);

export type AuthoredExercise = z.infer<typeof exerciseSchema>;
export type AuthoredUnit = z.infer<typeof unitSchema>;
export type CourseMeta = z.infer<typeof courseMetaSchema>;

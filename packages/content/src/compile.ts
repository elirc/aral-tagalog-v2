import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { CourseBundle, Exercise, Unit } from "@aral/core";
import { validateCourse } from "./validate";
import {
  assertTranslateDirection,
  courseMetaSchema,
  unitSchema,
  vocabFileSchema,
  type AuthoredExercise,
  type AuthoredUnit,
} from "./schema";

/**
 * Compiles YAML course sources into an immutable, versioned JSON bundle
 * (CNT-03) plus a manifest. Run via `pnpm --filter @aral/content build`.
 *
 * Output:
 *   dist/course_en_tl.json        — the bundle clients consume
 *   dist/course_en_tl_v<N>.json   — the same bundle under its versioned name
 *   dist/manifest.json            — { courseId, version, bundle, audio }
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const courseDir = join(root, "course", "en-tl");
const audioDir = join(root, "audio", "en-tl");
const outDir = join(root, "dist");

// deterministic shuffle so bundles are reproducible build-to-build
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = (h ^ c.charCodeAt(0)) * 16777619;
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function words(sentence: string): string[] {
  return sentence.replace(/[.,!?¡¿;:]/g, "").split(/\s+/).filter(Boolean);
}

function buildWordBank(answer: string, extra: string[] | undefined, seed: string): string[] {
  return seededShuffle([...words(answer), ...(extra ?? [])], seed);
}

/** ref -> Tagalog text to speak (null when we can't infer it from context) */
const audioRefs = new Map<string, string | null>();

function regAudio(ref: string | undefined, text?: string) {
  if (!ref) return;
  if (!audioRefs.get(ref)) audioRefs.set(ref, text ?? null);
}

function compileExercise(ex: AuthoredExercise, id: string): Exercise {
  switch (ex.type) {
    case "choice":
      // a choice answer can be in either language (English answers were
      // poisoning audio_texts.json with English speech text under Tagalog
      // refs), so the text must be authored explicitly via audio_text.
      // Without it the ref is registered text-less; vocab lemmas or other
      // exercises may fill it in later — regAudio overwrites null-text entries.
      regAudio(ex.audio, ex.audio_text);
      return { id, type: "choice", prompt: ex.prompt, answer: ex.answer, distractors: ex.distractors, audio: ex.audio, hint: ex.hint };
    case "translate": {
      assertTranslateDirection(ex, id);
      const toBase = Boolean(ex.prompt_tl);
      const prompt = (toBase ? ex.prompt_tl : ex.prompt_en)!;
      const answer = (toBase ? ex.answer_en : ex.answer_tl)!;
      regAudio(ex.audio, ex.audio_text ?? (toBase ? ex.prompt_tl : ex.answer_tl));
      return {
        id,
        type: "translate_taps",
        direction: toBase ? "target_to_base" : "base_to_target",
        prompt,
        answer,
        accept: ex.accept,
        wordBank: ex.word_bank ?? buildWordBank(answer, ex.extra_words, id),
        grading: ex.grading && { ngNang: ex.grading.ng_nang, hyphens: ex.grading.hyphens },
        // Only the target->base direction gets a play button: when the answer
        // is the Tagalog, the clip *is* the answer, and an audio button next
        // to an English prompt just reads it out before the learner tries.
        // The ref stays registered above, so the phrasebook/TTS still has it.
        audio: toBase ? ex.audio : undefined,
        hint: ex.hint,
      };
    }
    case "listen":
      regAudio(ex.audio, ex.audio_text ?? ex.answer_tl);
      return {
        id,
        type: "listen",
        audio: ex.audio,
        answer: ex.answer_tl,
        accept: ex.accept,
        wordBank: ex.word_bank ?? buildWordBank(ex.answer_tl, ex.extra_words, id),
        grading: ex.grading && { ngNang: ex.grading.ng_nang, hyphens: ex.grading.hyphens },
        hint: ex.hint,
      };
    case "match":
      return { id, type: "match_pairs", pairs: ex.pairs.map((p) => ({ left: p.tl, right: p.en })), hint: ex.hint };
    case "fill_blank":
      regAudio(ex.audio, ex.audio_text ?? ex.sentence.replace("___", ex.answer));
      return {
        id,
        type: "fill_blank",
        sentence: ex.sentence,
        translation: ex.translation,
        answer: ex.answer,
        options: ex.options,
        accept: ex.accept,
        grading: ex.grading && { ngNang: ex.grading.ng_nang, hyphens: ex.grading.hyphens },
        audio: ex.audio,
        hint: ex.hint,
      };
  }
}

function compileUnit(authored: AuthoredUnit): Unit {
  return {
    id: authored.id,
    title: authored.title,
    description: authored.description,
    tip: authored.tip,
    lessons: authored.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      xp: l.xp,
      exercises: l.exercises.map((ex, i) => compileExercise(ex, ex.id ?? `${l.id}-ex${i + 1}`)),
    })),
  };
}

function main() {
  const meta = courseMetaSchema.parse(parse(readFileSync(join(courseDir, "course.yaml"), "utf8")));
  const vocab = vocabFileSchema.parse(parse(readFileSync(join(courseDir, "vocab.yaml"), "utf8")));

  const unitFiles = readdirSync(join(courseDir, "units")).filter((f) => f.endsWith(".yaml")).sort();
  const units = unitFiles.map((f) => {
    const raw = parse(readFileSync(join(courseDir, "units", f), "utf8"));
    const parsed = unitSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ ${f}:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
      process.exit(1);
    }
    return compileUnit(parsed.data);
  });

  for (const v of vocab) regAudio(v.audio, v.lemma);

  // Audio manifest: every referenced ref maps to a bundle-relative path.
  // Missing files are allowed (AUD-02 fallback fills them in later) but reported.
  const audio: Record<string, string> = {};
  const missing: string[] = [];
  const silent: string[] = [];
  for (const [ref, text] of [...audioRefs.entries()].sort()) {
    audio[ref] = `audio/${ref}.mp3`;
    const hasFile = existsSync(join(audioDir, `${ref}.mp3`));
    if (!hasFile) missing.push(ref);
    // no recording *and* no spoken text: TTS can't fill this one either, so
    // the clip is permanently silent until someone records it or adds audio_text
    if (!hasFile && !text) silent.push(ref);
  }

  const problems = validateCourse(units, vocab);
  if (problems.length > 0) {
    console.error(`✗ content validation failed:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }

  const bundle: CourseBundle = {
    id: meta.id,
    baseLang: meta.base_lang,
    targetLang: meta.target_lang,
    version: meta.version,
    title: meta.title,
    units,
    vocab: Object.fromEntries(vocab.map((v) => [v.id, v])),
    audio,
    audioTexts: Object.fromEntries([...audioRefs.entries()].sort()),
  };

  mkdirSync(outDir, { recursive: true });
  // minified: dist/ is gitignored (no diffs to keep readable) and mobile
  // downloads this file over the network — indentation nearly doubled it
  const json = JSON.stringify(bundle);
  writeFileSync(join(outDir, `course_en_tl.json`), json);
  writeFileSync(join(outDir, `course_en_tl_v${meta.version}.json`), json);
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(
      { courseId: meta.id, version: meta.version, bundle: `course_en_tl_v${meta.version}.json`, audio },
      null,
      2,
    ),
  );

  // ref -> spoken text, consumed by scripts/generate-audio.mjs (AUD-02)
  writeFileSync(
    join(outDir, "audio_texts.json"),
    JSON.stringify(Object.fromEntries([...audioRefs.entries()].sort()), null, 2),
  );

  const lessons = units.reduce((n, u) => n + u.lessons.length, 0);
  const exercises = units.reduce((n, u) => n + u.lessons.reduce((m, l) => m + l.exercises.length, 0), 0);
  console.log(`✓ compiled ${meta.id} v${meta.version}: ${units.length} units, ${lessons} lessons, ${exercises} exercises, ${audioRefs.size} audio refs`);
  if (missing.length > 0)
    console.warn(`⚠ ${missing.length} audio refs have no recording yet (run scripts/generate-audio to fill with TTS)`);
  if (silent.length > 0)
    console.warn(
      `⚠ ${silent.length} of those have no spoken text either — TTS can't voice them. Add audio_text: ${silent.slice(0, 5).join(", ")}${silent.length > 5 ? ", …" : ""}`,
    );
}

main();

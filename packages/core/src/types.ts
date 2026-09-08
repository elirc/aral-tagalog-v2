/**
 * Content types shared by the compiler, API, and both clients.
 * A CourseBundle is the compiled, immutable artifact clients download.
 */

export type LangCode = string; // BCP-47-ish: "en", "tl", "es"

export interface CourseBundle {
  /** e.g. "en-tl" (base-target) — the CON-04 extensibility key */
  id: string;
  baseLang: LangCode;
  targetLang: LangCode;
  version: number;
  title: string;

  /**
   * Ordered difficulty tracks (Foundations → Mastery). Every unit names one
   * via `Unit.tier`. Optional: a bundle without tiers is a flat course that
   * unlocks linearly, exactly as it did before tiers existed.
   */
  tiers?: CourseTier[];
  units: Unit[];
  /** vocabId -> entry; exercises reference these for audio/translations */
  vocab: Record<string, VocabEntry>;
  /** audioRef -> relative file path within the bundle (e.g. "audio/kumusta_ka.mp3") */
  audio: Record<string, string>;
  /**
   * audioRef -> target-language text spoken in that clip (null when unknown).
   * Lets clients fall back to device TTS while a recording is missing (AUD-02).
   */
  audioTexts?: Record<string, string | null>;
}

export interface VocabEntry {
  id: string;
  lemma: string; // target-language word/phrase
  translation: string; // base-language meaning
  audio?: string; // audioRef
  notes?: string;
}

/**
 * A difficulty track. Tiers group units into skill levels so a learner who
 * already speaks some Tagalog can be placed into a later track instead of
 * grinding up from unit 1 (a `tier_started` progress event records the jump).
 */
export interface CourseTier {
  id: string;
  title: string;
  /** one-line pitch shown on the course map and the placement screen */
  description?: string;
  /** what a learner entering here is assumed to know already */
  entryHint?: string;
  /** accent color for this tier's section of the course map */
  color?: string;
}

export interface Unit {
  id: string;
  title: string;
  /** id of the CourseTier this unit belongs to; undefined in a flat course */
  tier?: string;
  description?: string;
  /** short grammar/culture note shown on the course map */
  tip?: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  xp: number;
  exercises: Exercise[];
}

export interface ExerciseBase {
  id: string;
  /** audioRef played with the prompt (target-language audio) */
  audio?: string;
  hint?: string;
}

/** Pick the right answer among distractors. */
export interface ChoiceExercise extends ExerciseBase {
  type: "choice";
  prompt: string;
  answer: string;
  distractors: string[];
}

/** Translate a sentence by tapping words from a bank. */
export interface TranslateTapsExercise extends ExerciseBase {
  type: "translate_taps";
  /** which way we translate; prompt is shown, answer is built from the bank */
  direction: "target_to_base" | "base_to_target";
  prompt: string;
  answer: string;
  /** additional accepted answers */
  accept?: string[];
  wordBank: string[];
  grading?: GradingFlags;
}

/** "Tap what you hear" — audio prompt, build the target-language sentence. */
export interface ListenExercise extends ExerciseBase {
  type: "listen";
  audio: string; // required for this type
  answer: string;
  accept?: string[];
  wordBank: string[];
  grading?: GradingFlags;
}

/** Match target-language words to base-language translations. */
export interface MatchPairsExercise extends ExerciseBase {
  type: "match_pairs";
  pairs: Array<{ left: string; right: string }>;
}

/** Sentence with a blank; pick or type the missing word. */
export interface FillBlankExercise extends ExerciseBase {
  type: "fill_blank";
  /** sentence containing "___" where the answer goes */
  sentence: string;
  translation?: string;
  answer: string;
  /** if present, render as buttons; otherwise free text input */
  options?: string[];
  accept?: string[];
  grading?: GradingFlags;
}

export interface GradingFlags {
  /** accept ng/nang interchangeably (CNT-04) */
  ngNang?: boolean;
  /** tolerate missing hyphens in reduplication: "araw-araw" vs "araw araw" */
  hyphens?: boolean;
}

/**
 * Word-order drill: the tokens are exactly the answer’s words, shuffled, with
 * no distractors. Unlike translate_taps (which tests vocabulary recall) the
 * learner already has every word and only has to get Tagalog syntax right —
 * an advanced-tier exercise.
 */
export interface ArrangeExercise extends ExerciseBase {
  type: "arrange";
  /** what the sentence should mean, shown above the tokens */
  prompt: string;
  answer: string;
  accept?: string[];
  tokens: string[];
  grading?: GradingFlags;
}

export interface DialogueLine {
  /** who is speaking, e.g. "Tindera" */
  speaker?: string;
  /** line text; each "___" is filled by the next entry in `blanks` */
  text: string;
  /** English gloss shown under the line */
  translation?: string;
}

export interface DialogueBlank {
  answer: string;
  accept?: string[];
  /** rendered as buttons for this blank; free text input when omitted */
  options?: string[];
}

/**
 * A short conversation (or passage) with several blanks — reading
 * comprehension in context rather than one sentence at a time. Answered as a
 * string[] parallel to `blanks`; every blank must be right for the exercise
 * to count as correct.
 */
export interface DialogueExercise extends ExerciseBase {
  type: "dialogue";
  /** scene-setting line, e.g. "At the market" */
  intro?: string;
  lines: DialogueLine[];
  blanks: DialogueBlank[];
  grading?: GradingFlags;
}

export type Exercise =
  | ChoiceExercise
  | TranslateTapsExercise
  | ListenExercise
  | MatchPairsExercise
  | FillBlankExercise
  | ArrangeExercise
  | DialogueExercise;

export type ExerciseType = Exercise["type"];

/** Lightweight navigation data: exercise bodies are loaded only for play. */
export type LessonOverview = Pick<Lesson, "id" | "title" | "xp">;
export type UnitOverview = Omit<Unit, "lessons"> & { lessons: LessonOverview[] };

export interface WebCourseIndex extends Omit<CourseBundle, "units" | "vocab" | "audio" | "audioTexts"> {
  units: Array<UnitOverview & { file: string }>;
  vocabFile: string;
  /** Hashed, partitioned exercise-ID lookups, fetched only for mistake review. */
  reviewFiles: string[];
}

export interface WebUnitContent {
  courseId: string;
  version: number;
  unit: Unit;
  audio: CourseBundle["audio"];
  audioTexts: NonNullable<CourseBundle["audioTexts"]>;
}
export interface WebVocabContent {
  courseId: string;
  version: number;
  vocab: CourseBundle["vocab"];
  audio: CourseBundle["audio"];
}
export interface WebReviewIndex {
  courseId: string;
  version: number;
  /** Exercise ID to the index of its unit in WebCourseIndex.units. */
  unitsByExercise: Record<string, number>;
}
